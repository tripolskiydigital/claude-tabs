import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, FsStat, Register } from 'claude-code'

import type { HotkeyModifier, Lang, Project, SessionState } from '../types'
import { AGENT_LABEL, hotkeyPaths, lastLine } from './hotkeys'
import type { AgentResult, HotkeyPaths } from './hotkeys'
import { langOf, stateLabel, t } from './i18n'
import {
  DIGIT_WIDTH,
  digitSvg,
  OVERRIDE_CANDIDATES,
  STATES,
  DOT_ROW_HEIGHT,
  EMOJI_CHOICES,
  STATE_TEXT_COLORS,
  SKIP_DIRS,
  groupProjects,
  iconRank,
  dataUri,
  countPillSvg,
  countPillWidth,
  dotSvg,
  TAB_HEIGHT,
  tabIconSvg,
  isImagePath,
  letterColor,
  letterOf,
  mimeOf,
  move,
  parseLive,
  parseSession,
  sessionUrl,
  tabUrl,
  topState,
} from './lib'
import type { LiveSession, SessionMeta } from './lib'

const PANE = 'project-tabs'
/** Statuses change by the second: a poll reads only the files whose mtime moved. */
const REFRESH_MS = 4_000
/** Image files past this are skipped: an Svg's source holds 131072 characters. */
const MAX_ICON_BYTES = 90_000
/** How deep, and through how many folders, an icon is looked for in a project. */
const ICON_DEPTH = 4
const ICON_DIRS = 300

const projects = atom({ plugin: 'project-tabs', key: 'projects' } as const, [])
const pinned = atom({ plugin: 'project-tabs', key: 'pinned' } as const, [])
const icons = atom({ plugin: 'project-tabs', key: 'icons' } as const, {})
const favicons = atom({ plugin: 'project-tabs', key: 'favicons' } as const, {})
const current = atom({ plugin: 'project-tabs', key: 'current' } as const, '')
const editing = atom({ plugin: 'project-tabs', key: 'editing' } as const, null)
const lang = atom({ plugin: 'project-tabs', key: 'lang' } as const, 'en')
const hotkeys = atom({ plugin: 'project-tabs', key: 'hotkeys' } as const, 'off')

/** The tabs a digit reaches: ⌃1 is the first pinned project, ⌃9 the ninth. */
const HOTKEY_TABS = 9

const KEYS_LABEL: Record<Exclude<HotkeyModifier, 'off'>, string> = { control: '⌃1–9', command: '⌘1–9' }

function asModifier(value: unknown): HotkeyModifier {
  return value === 'control' || value === 'command' ? value : 'off'
}

type Engine = EngineInterface

/** Parsed session files by path, kept while their mtime stands. */
const sessionCache = new Map<string, { mtimeMs: number; meta: SessionMeta | null }>()

async function sessionsRoot($: Engine): Promise<string> {
  const home = await $.env.get('HOME')
  return `${home ?? ''}/Library/Application Support/Claude/claude-code-sessions`
}

async function listDirs($: Engine, path: string): Promise<string[]> {
  const entries = await $.fs.list(path).catch(() => [])
  return entries.filter(e => e.kind === 'dir').map(e => `${path}/${e.name}`)
}

async function scanSessions($: Engine): Promise<SessionMeta[]> {
  const root = await sessionsRoot($)
  const leaves = (await Promise.all((await listDirs($, root)).map(d => listDirs($, d)))).flat()
  const metas = await Promise.all(
    leaves.map(async dir => {
      const files = (await $.fs.list(dir).catch(() => [])).filter(
        f => f.kind === 'file' && /^local_.*\.json$/.test(f.name),
      )
      return Promise.all(
        files.map(async f => {
          const path = `${dir}/${f.name}`
          const cached = sessionCache.get(path)
          if (cached?.mtimeMs === f.mtimeMs) return cached.meta
          const meta = parseSession(await $.fs.read(path).catch(() => ''))
          sessionCache.set(path, { mtimeMs: f.mtimeMs, meta })
          return meta
        }),
      )
    }),
  )
  return metas.flat().filter((m): m is SessionMeta => m !== null)
}

/** Parsed live-process files by path, kept while their mtime stands. */
const liveCache = new Map<string, { mtimeMs: number; live: LiveSession | null }>()

/** The running Claude Code processes by the desktop session each serves. */
async function scanLive($: Engine): Promise<Map<string, LiveSession>> {
  const dir = `${(await $.env.get('HOME')) ?? ''}/.claude/sessions`
  const files = (await $.fs.list(dir).catch(() => [])).filter(
    f => f.kind === 'file' && /^\d+\.json$/.test(f.name),
  )
  const found = (
    await Promise.all(
      files.map(async f => {
        const path = `${dir}/${f.name}`
        const cached = liveCache.get(path)
        if (cached?.mtimeMs === f.mtimeMs) return cached.live
        const live = parseLive(await $.fs.read(path).catch(() => ''))
        liveCache.set(path, { mtimeMs: f.mtimeMs, live })
        return live
      }),
    )
  ).filter((l): l is LiveSession => l !== null)
  if (found.length === 0) return new Map()

  // A process that died without cleaning up leaves its file: keep the living.
  // `ps` lists this machine's process ids; nothing else is read from it.
  let pids = ''
  try {
    const ps = await $.process.run(['ps', '-A', '-o', 'pid='])
    pids = ps.stdout
  } catch {
    pids = ''
  }
  const alive = new Set(pids.split(/\s+/).filter(Boolean).map(Number))
  const byHost = new Map<string, LiveSession>()
  for (const l of found) {
    const prev = byHost.get(l.hostSessionId)
    if (alive.has(l.pid) && (prev === undefined || l.statusUpdatedAt > prev.statusUpdatedAt)) {
      byHost.set(l.hostSessionId, l)
    }
  }
  return byHost
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

function asStringRecord(value: unknown): Record<string, string> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter((kv): kv is [string, string] => typeof kv[1] === 'string'),
  )
}

/** Whether a value differs from the one held, so a quiet refresh writes and redraws nothing. */
function changed(prev: unknown, next: unknown): boolean {
  return JSON.stringify(prev) !== JSON.stringify(next)
}

async function expandHome($: Engine, path: string): Promise<string> {
  return path.startsWith('~') ? `${(await $.env.get('HOME')) ?? ''}${path.slice(1)}` : path
}

async function readIcon($: Engine, path: string): Promise<string | null> {
  const mime = mimeOf(path)
  if (mime === undefined) return null
  try {
    const stat = await $.fs.stat(path)
    if (stat.kind !== 'file' || stat.size === 0 || stat.size > MAX_ICON_BYTES) return null
    const { base64 } = await $.fs.read(path, { as: 'bytes' })
    return dataUri(base64, mime)
  } catch {
    return null
  }
}

/** Walks the project breadth first, best-ranked icon files first. */
async function iconFiles($: Engine, root: string): Promise<string[]> {
  const found: { path: string; rank: number }[] = []
  let level = ['']
  let walked = 0
  for (let depth = 0; depth <= ICON_DEPTH && level.length > 0; depth++) {
    const nextLevel: string[] = []
    for (const rel of level) {
      if (walked++ >= ICON_DIRS) break
      const entries = await $.fs.list(rel === '' ? root : `${root}/${rel}`).catch(() => [])
      for (const entry of entries) {
        const child = rel === '' ? entry.name : `${rel}/${entry.name}`
        if (entry.kind === 'dir') {
          if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) nextLevel.push(child)
          continue
        }
        const rank = entry.kind === 'file' ? iconRank(child) : undefined
        if (rank !== undefined) found.push({ path: `${root}/${child}`, rank })
      }
    }
    level = nextLevel
  }
  return found.sort((a, b) => a.rank - b.rank).map(f => f.path)
}

async function findIcon(
  $: Engine,
  projectPath: string,
  override: string | undefined,
): Promise<string | null> {
  // A picture chosen in the pane is kept in the plugin's store as a data URI.
  if (override?.startsWith('data:image/')) return override
  if (override !== undefined && isImagePath(override)) {
    const svg = await readIcon($, await expandHome($, override))
    if (svg !== null) return svg
  }
  for (const candidate of OVERRIDE_CANDIDATES) {
    const svg = await readIcon($, `${projectPath}/${candidate}`)
    if (svg !== null) return svg
  }
  for (const path of await iconFiles($, projectPath)) {
    const svg = await readIcon($, path)
    if (svg !== null) return svg
  }
  return null
}

/** Looks up the icon of every pinned project not looked up yet (or all, when forced). */
async function loadFavicons($: Engine, force = false): Promise<Record<string, string | null>> {
  const list = await read($, pinned)
  const overrides = await read($, icons)
  const known = force ? {} : await read($, favicons)
  const next: Record<string, string | null> = {}
  for (const path of list) {
    const had = known[path]
    next[path] = had === null || had?.startsWith('data:') ? had : await findIcon($, path, overrides[path])
  }
  if (changed(await read($, favicons), next)) await update($, favicons, () => next)
  return next
}

async function reloadIcons($: Engine): Promise<void> {
  const found = await loadFavicons($, true)
  const all = Object.values(found)
  const named = all.filter(svg => svg !== null).length
  const vars = { found: named, total: all.length }
  $.ui.toast(t(await read($, lang), named === all.length ? 'iconsAll' : 'iconsSome', vars))
}

/** The desktop's settings file: its `locale` is the interface language. */
let localeCache: { mtimeMs: number; lang: Lang } | undefined

/**
 * The language the desktop is set to. The file holds other things (encrypted
 * tokens among them), so the mod never reads it: grep hands back the one
 * `"locale": "…"` pair and nothing else reaches the mod.
 */
async function desktopLang($: Engine): Promise<Lang> {
  try {
    const path = `${(await $.env.get('HOME')) ?? ''}/Library/Application Support/Claude/config.json`
    const { mtimeMs } = await $.fs.stat(path)
    if (localeCache?.mtimeMs === mtimeMs) return localeCache.lang
    const found = await $.process.run([
      'grep',
      '-o',
      '-m',
      '1',
      '"locale"[[:space:]]*:[[:space:]]*"[^"]*"',
      path,
    ])
    const locale = /"locale"\s*:\s*"([^"]*)"/.exec(found.stdout)?.[1]
    localeCache = { mtimeMs, lang: langOf(locale) }
    return localeCache.lang
  } catch {
    return 'en'
  }
}

async function loadLang($: Engine): Promise<Lang> {
  const found = await desktopLang($)
  if (found !== (await read($, lang))) await update($, lang, () => found)
  return found
}

/**
 * Asks for an image with the system's own file dialog, then keeps it in the
 * plugin's store as a data URI: a raster scaled to 64px as PNG, an SVG as it is.
 * No file of the mod's is written.
 */
async function chooseIconFile($: Engine, path: string, name: string): Promise<void> {
  const l = await read($, lang)
  const prompt = t(l, 'choosePrompt', { name })
  // helper/choose-icon.applescript shows the system's file dialog and prints the path.
  const picked = await $.process.run(
    ['osascript', `${$.plugin.root}/helper/choose-icon.applescript`, prompt],
    {
      timeoutMs: 600_000,
    },
  )
  // A cancelled dialog exits non-zero (-128): nothing to do.
  const source = picked.stdout.trim()
  if (picked.exitCode !== 0 || source === '') return

  let picture: string | null
  if (/\.svg$/i.test(source)) {
    picture = await readIcon($, source)
    if (picture === null) {
      $.ui.toast(t(l, 'fileTooBig'))
      return
    }
  } else {
    // sips (part of macOS) scales the picture to 64px as PNG, into the temp folder.
    const scaledPath = `${(await $.env.get('TMPDIR')) ?? '/tmp/'}`.replace(/\/?$/, '/claude-tabs-icon.png')
    const scaled = await $.process.run([
      'sips',
      '-s',
      'format',
      'png',
      '-Z',
      '64',
      source,
      '--out',
      scaledPath,
    ])
    picture = scaled.exitCode === 0 ? await readIcon($, scaledPath) : null
    if (picture === null) {
      $.ui.toast(t(l, 'iconFailed', { error: scaled.stderr.trim() || source }))
      return
    }
  }
  await saveIcon($, path, picture)
  await update($, editing, () => null)
}

async function refresh($: Engine): Promise<SessionMeta[]> {
  const [sessions, live, id] = await Promise.all([scanSessions($), scanLive($), $.session.id()])
  const mine = sessions.find(s => s.cliSessionId === id)
  const grouped = groupProjects(sessions, live, mine?.sessionId ?? null)
  if (changed(await read($, projects), grouped)) await update($, projects, () => grouped)

  await loadLang($)

  const here = mine?.path ?? (await $.session.cwd())
  if (changed(await read($, current), here)) await update($, current, () => here)

  // Another session may have pinned or re-iconed since: the store is the truth.
  const storedPins = asStrings(await $.store.get('pinned'))
  if (changed(await read($, pinned), storedPins)) await update($, pinned, () => storedPins)
  const storedIcons = asStringRecord(await $.store.get('icons'))
  if (changed(await read($, icons), storedIcons)) await update($, icons, () => storedIcons)
  const modifier = asModifier(await $.store.get('hotkeys'))
  if (modifier !== (await read($, hotkeys))) await update($, hotkeys, () => modifier)
  if (modifier !== 'off') await writeHotkeyConfig($, modifier, hotkeyTargets(grouped, storedPins))
  await loadFavicons($)
  return sessions
}

async function shortcutPaths($: Engine): Promise<HotkeyPaths> {
  return hotkeyPaths((await $.env.get('HOME')) ?? '', $.plugin.root)
}

let lastHotkeyConfig = ''

/** Tells the agent which modifier to hold and where each of the tabs 1…9 leads. */
async function writeHotkeyConfig(
  $: Engine,
  modifier: HotkeyModifier,
  targets: readonly (string | null)[],
): Promise<void> {
  const text = `${JSON.stringify({ modifier, targets }, null, 2)}\n`
  if (text === lastHotkeyConfig) return
  const home = (await $.env.get('HOME')) ?? ''
  // Read by the shortcut helper (helper/tabs-hotkeys.swift), nothing else.
  await $.fs.write(`${home}/.claude/project-tabs/hotkeys.json`, text)
  lastHotkeyConfig = text
}

/**
 * Builds the agent from its Swift source with swiftc when there is no binary
 * or the source is newer (a plugin update).
 */
async function buildAgent($: Engine, p: HotkeyPaths): Promise<AgentResult> {
  let source: FsStat | undefined
  let binary: FsStat | undefined
  try {
    source = await $.fs.stat(p.source)
  } catch {
    return { isOk: false, error: `${p.source} is missing` }
  }
  try {
    binary = await $.fs.stat(p.binary)
  } catch {
    binary = undefined
  }
  if (binary !== undefined && binary.mtimeMs >= source.mtimeMs) return { isOk: true }

  // The binary goes beside hotkeys.json, whose write (always first) made the folder.
  try {
    let built = await $.process.run(['swiftc', '-O', '-o', p.binary, p.source], { timeoutMs: 300_000 })
    if (built.exitCode !== 0 && built.stderr.includes("redefinition of module 'SwiftBridging'")) {
      // Some Command Line Tools ship one module map twice; the overlay shipped
      // in helper/build/ maps the duplicate onto an empty file for this build.
      built = await $.process.run(
        [
          'swiftc',
          '-O',
          '-vfsoverlay',
          p.overlay,
          '-Xcc',
          '-ivfsoverlay',
          '-Xcc',
          p.overlay,
          '-o',
          p.binary,
          p.source,
        ],
        { timeoutMs: 300_000 },
      )
    }
    return built.exitCode === 0
      ? { isOk: true, isRebuilt: true }
      : { isOk: false, error: lastLine(built.stderr) }
  } catch {
    return { isOk: false, error: 'swiftc not found (xcode-select --install)' }
  }
}

async function isAgentRunning($: Engine): Promise<boolean> {
  try {
    const listed = await $.process.run(['launchctl', 'list', AGENT_LABEL])
    return listed.exitCode === 0
  } catch {
    return false
  }
}

/**
 * Builds the agent if needed and has launchd run it, kept alive, with no file
 * of its own: `launchctl submit` lasts until logout, and every session start
 * submits it again while the shortcuts are on.
 */
async function ensureAgent($: Engine): Promise<AgentResult> {
  const p = await shortcutPaths($)
  const built = await buildAgent($, p)
  if (!built.isOk) return built
  if (await isAgentRunning($)) {
    if (built.isRebuilt !== true) return { isOk: true }
    await $.process.run(['launchctl', 'remove', AGENT_LABEL])
  }
  const submitted = await $.process.run(['launchctl', 'submit', '-l', AGENT_LABEL, '--', p.binary])
  // Another session may have submitted it a moment before: running is what counts.
  if (submitted.exitCode !== 0 && !(await isAgentRunning($))) {
    return { isOk: false, error: lastLine(submitted.stderr) }
  }
  return { isOk: true }
}

/** Stops the agent; the built binary stays for a later switch-on. */
async function removeAgent($: Engine): Promise<void> {
  if (await isAgentRunning($)) await $.process.run(['launchctl', 'remove', AGENT_LABEL])
}

/** Where each digit leads: the pinned project's last session, as a click on its tab. */
function hotkeyTargets(all: readonly Project[], list: readonly string[]): (string | null)[] {
  return Array.from({ length: HOTKEY_TABS }, (_, i) => {
    const path = list[i]
    if (path === undefined) return null
    return tabUrl(all.find(p => p.path === path) ?? { path, lastSessionId: null })
  })
}

/**
 * Switches the tab shortcuts: off takes the agent out of launchd; a modifier
 * builds the agent (the first time, some seconds) and has launchd run it.
 */
async function setHotkeys($: Engine, modifier: HotkeyModifier): Promise<void> {
  const l = await read($, lang)
  await $.store.set('hotkeys', modifier)
  await update($, hotkeys, () => modifier)
  await writeHotkeyConfig($, modifier, hotkeyTargets(await read($, projects), await read($, pinned)))
  if (modifier === 'off') {
    await removeAgent($)
    $.ui.toast(t(l, 'shortcutsDisabled'))
    return
  }
  $.ui.toast(t(l, 'shortcutsBuilding'))
  const agent = await ensureAgent($)
  $.ui.toast(
    agent.isOk
      ? t(l, 'shortcutsOn', { keys: KEYS_LABEL[modifier] })
      : t(l, 'shortcutsFailed', { error: agent.error }),
  )
}

async function savePinned($: Engine, list: string[]): Promise<void> {
  await $.store.set('pinned', list)
  await update($, pinned, () => list)
  await loadFavicons($)
}

async function saveIcon($: Engine, path: string, value: string): Promise<void> {
  const next = { ...asStringRecord(await $.store.get('icons')) }
  if (value.trim() === '') delete next[path]
  else next[path] = value.trim()
  await $.store.set('icons', next)
  await update($, icons, () => next)
  const known = { ...(await read($, favicons)) }
  delete known[path]
  await update($, favicons, () => known)
  await loadFavicons($)
}

async function openProject($: Engine, path: string): Promise<void> {
  if (path === (await read($, current))) return
  // Rescan first: the last session of a project changes as the person works.
  const sessions = await refresh($)
  const project = groupProjects(sessions.filter(s => s.path === path))[0] ?? {
    path,
    lastSessionId: null,
  }
  await openUrl($, tabUrl(project))
}

async function openUrl($: Engine, url: string): Promise<void> {
  const { exitCode, stderr } = await $.process.run(['open', url])
  if (exitCode !== 0) $.ui.toast(t(await read($, lang), 'openFailed', { error: stderr.trim() }))
}

async function openPane($: Engine): Promise<unknown> {
  const title = t(await read($, lang), 'title')
  return $.ui.open({ id: PANE, title, focus: true, closeOnEscape: true, rows: 20 })
}

/** The ⋯ button: opens the pane, or closes it when it is open. */
async function togglePane($: Engine): Promise<void> {
  const isOpen = (await $.ui.panes()).some(pane => pane.id === PANE)
  if (isOpen) await $.ui.close({ id: PANE })
  else await openPane($)
}

function nameOf(list: readonly Project[], path: string): string {
  return list.find(p => p.path === path)?.name ?? path.split('/').filter(Boolean).at(-1) ?? path
}

type IconElements = { Text: Elements['desktop']['Text']; Svg?: Elements['desktop']['Svg'] }

/**
 * A project's icon, 20px with rounded corners in a 28px box: its image, its
 * emoji, or its first letter on a square of its own color. Where the surface
 * draws no SVG (the terminal), the emoji or the letter as text.
 */
function projectIcon(
  { Text, Svg }: IconElements,
  name: string,
  override: string | undefined,
  uri: string | null | undefined,
) {
  const emoji = override !== undefined && !isImagePath(override) ? override : undefined
  if (Svg === undefined) {
    return emoji !== undefined ? (
      <Text>{emoji}</Text>
    ) : (
      <Text backgroundColor={letterColor(name)} color="#ffffff" bold>{` ${letterOf(name)} `}</Text>
    )
  }
  const source = tabIconSvg(
    emoji !== undefined
      ? { kind: 'emoji', text: emoji }
      : uri != null
        ? { kind: 'image', uri }
        : { kind: 'letter', name },
  )
  return <Svg source={source} alt={name} width={TAB_HEIGHT} height={TAB_HEIGHT} />
}

/** A session's dot as the sidebar draws it, at the height of a list row. */
function stateDot({ Text, Svg }: IconElements, state: SessionState, l: Lang) {
  if (Svg !== undefined)
    return <Svg source={dotSvg(state)} alt={stateLabel(l, state)} width={12} height={DOT_ROW_HEIGHT} />
  return <Text color={STATE_TEXT_COLORS[state]}>{state === 'idle' ? '○' : '●'}</Text>
}

/** The count of a project's sessions, in the color of the most urgent; nothing for none. */
function sessionCount({ Text, Svg }: IconElements, project: Project | undefined, l: Lang) {
  const count = project?.sessionCount ?? 0
  if (count === 0) return null
  const state = topState(project!.counts)
  if (Svg !== undefined) {
    return (
      <Svg
        source={countPillSvg(count, state)}
        alt={`${count} ${stateLabel(l, state)}`}
        width={countPillWidth(count)}
        height={TAB_HEIGHT}
      />
    )
  }
  return state === 'idle' ? (
    <Text dimColor>{count}</Text>
  ) : (
    <Text color={STATE_TEXT_COLORS[state]} bold>
      {count}
    </Text>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'tabs', description: t(await loadLang($), 'cmdDesc') })
    $.clock.every(REFRESH_MS, () => void refresh($))
    // Shortcuts that are on stay on: after a reboot or a plugin update the
    // agent is started, or rebuilt, here, once the first refresh has written
    // hotkeys.json (and so made the agent's folder).
    void (async () => {
      await refresh($)
      if (asModifier(await $.store.get('hotkeys')) === 'off') return
      const agent = await ensureAgent($)
      if (!agent.isOk) $.ui.toast(t(await read($, lang), 'shortcutsFailed', { error: agent.error }))
    })()

    return next(e)
  })

  on('command.run', { command: 'tabs' }, async $ => {
    await refresh($)
    await openPane($)

    return { text: t(await read($, lang), 'cmdOpened') }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)

    const [all, list, overrides, svgs, here, l, modifier] = await Promise.all([
      read($, projects),
      read($, pinned),
      read($, icons),
      read($, favicons),
      read($, current),
      read($, lang),
      read($, hotkeys),
    ])
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const Svg = 'Svg' in els ? els.Svg : undefined

    // A hover only paints over a color the Box already has: the desktop's
    // tabs start transparent. The terminal has no such color.
    const isTerminal = e.surface === 'terminal'
    const base = isTerminal ? {} : { backgroundColor: 'transparent' }
    // The active tab is filled; a hovered one gets a lighter wash of its own.
    const ACTIVE = 'userMessageBackground'
    const HOVER = isTerminal ? ACTIVE : 'rgba(128, 128, 128, 0.14)'
    // The name's own button lights under the pointer: the tab's fill is enough.
    const quietButton = isTerminal ? {} : { hover: { backgroundColor: 'transparent' } }
    const manage = (
      <Box key="manage-box" alignSelf="center" flexShrink={0}>
        <Button key="manage" label="⋯" onPress={() => void togglePane($)} />
      </Box>
    )

    if (list.length === 0) {
      return (
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Text dimColor>{t(l, 'noPinned')}</Text>
          {here !== '' && (
            <Button
              key="pin-current"
              label={t(l, 'pinThis')}
              onPress={async () => savePinned($, [...(await read($, pinned)), here])}
            />
          )}
          {manage}
        </Box>
      )
    }

    const iconEls = { Text, ...(Svg !== undefined ? { Svg } : {}) }

    return (
      <Box flexDirection="row" alignItems="center" justifyContent="space-between" columnGap={1}>
        <Box flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={1} flexShrink={1}>
          {list.map((path, i) => {
            const project = all.find(p => p.path === path)
            const name = nameOf(all, path)
            const isHere = path === here
            const recent = project?.recent ?? []
            const count = project?.sessionCount ?? 0

            return (
              <Box
                key={`tab-${i}`}
                {...(isTerminal || count === 0 ? { paddingRight: 1 } : {})}
                position="relative"
                flexDirection="row"
                alignItems="center"
                {...(isHere ? { backgroundColor: ACTIVE } : base)}
                hover={{ backgroundColor: isHere ? ACTIVE : HOVER }}
              >
                {modifier !== 'off' &&
                  i < HOTKEY_TABS &&
                  (Svg !== undefined ? (
                    <Svg
                      source={digitSvg(i + 1)}
                      alt={`${KEYS_LABEL[modifier].slice(0, 1)}${i + 1}`}
                      width={DIGIT_WIDTH}
                      height={TAB_HEIGHT}
                    />
                  ) : (
                    <Text dimColor>{`${i + 1} `}</Text>
                  ))}
                {projectIcon(iconEls, name, overrides[path], svgs[path])}
                <Button
                  key={`open-${i}`}
                  label={name}
                  plain
                  {...(isHere ? {} : { dimColor: true })}
                  {...quietButton}
                  onPress={() => void openProject($, path)}
                />
                {sessionCount(iconEls, project, l)}
                {recent.length > 0 && (
                  <Box
                    position="absolute"
                    bottom={2}
                    left={0}
                    display="none"
                    hover={{ display: 'flex' }}
                    flexDirection="column"
                    minWidth={32}
                    paddingX={1}
                    borderStyle="round"
                    borderColor="inactive"
                    backgroundColor="userMessageBackground"
                  >
                    <Text dimColor>{t(l, 'recentSessions', { name })}</Text>
                    {recent.map((session, j) => (
                      <Box flexDirection="row" alignItems="center" gap={1}>
                        {stateDot(iconEls, session.state, l)}
                        <Button
                          key={`session-${i}-${j}`}
                          label={session.title}
                          plain
                          onPress={() => void openUrl($, sessionUrl(session.id))}
                        />
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            )
          })}
        </Box>
        {manage}
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const [all, list, overrides, svgs, here, edited, l, modifier] = await Promise.all([
      read($, projects),
      read($, pinned),
      read($, icons),
      read($, favicons),
      read($, current),
      read($, editing),
      read($, lang),
      read($, hotkeys),
    ])
    const els = $.ui.resolve(e)
    const { Box, Text, Button } = els
    const Svg = 'Svg' in els ? els.Svg : undefined
    const Input = 'Input' in els ? els.Input : undefined
    const iconEls = { Text, ...(Svg !== undefined ? { Svg } : {}) }
    // Every project with a desktop session, newest first: the pinned ones are above.
    const others = all.filter(p => !list.includes(p.path))
    const projectOf = (path: string) => all.find(p => p.path === path)

    const pickIcon = async (path: string, value: string) => {
      await saveIcon($, path, value)
      await update($, editing, () => null)
    }

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Text bold>{t(l, 'shortcuts')}</Text>
          <Box flexDirection="row" flexShrink={0} gap={1}>
            {(['off', 'control', 'command'] as const).map(choice => (
              <Button
                key={`hotkeys-${choice}`}
                label={choice === 'off' ? t(l, 'shortcutsOff') : KEYS_LABEL[choice]}
                {...(choice === modifier ? { variant: 'primary' as const } : {})}
                onPress={() => void (choice !== modifier && setHotkeys($, choice))}
              />
            ))}
          </Box>
        </Box>
        <Box flexDirection="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Text bold>{t(l, 'pinned')}</Text>
          <Button key="reload-icons" label={t(l, 'refreshIcons')} onPress={() => void reloadIcons($)} />
        </Box>
        {list.length === 0 && <Text dimColor>{t(l, 'emptyPinned')}</Text>}
        {list.map((path, i) => {
          const name = nameOf(all, path)
          const override = overrides[path]
          const emoji = override !== undefined && !isImagePath(override) ? override : ''
          return (
            <Box key={`pinned-${i}`} flexDirection="column">
              <Box flexDirection="row" alignItems="center" justifyContent="space-between" gap={1}>
                <Box flexDirection="row" alignItems="center" flexShrink={1}>
                  {projectIcon(iconEls, name, override, svgs[path])}
                  {sessionCount(iconEls, projectOf(path), l)}
                  <Text wrap="truncate" bold={path === here}>
                    {name}
                  </Text>
                </Box>
                <Box flexDirection="row" flexShrink={0} gap={1}>
                  <Button
                    key={`up-${i}`}
                    label="↑"
                    plain
                    onPress={() => void savePinned($, move(list, i, -1))}
                  />
                  <Button
                    key={`down-${i}`}
                    label="↓"
                    plain
                    onPress={() => void savePinned($, move(list, i, 1))}
                  />
                  <Button
                    key={`edit-${i}`}
                    label="✎"
                    plain
                    onPress={() => void update($, editing, now => (now === path ? null : path))}
                  />
                  <Button
                    key={`unpin-${i}`}
                    label="✕"
                    plain
                    onPress={() =>
                      void savePinned(
                        $,
                        list.filter(p => p !== path),
                      )
                    }
                  />
                </Box>
              </Box>
              {edited === path && (
                <Box flexDirection="column" gap={1} paddingLeft={2} paddingTop={1}>
                  <Box flexDirection="row" flexWrap="wrap" gap={1}>
                    <Button
                      key={`file-${i}`}
                      label={t(l, 'chooseFile')}
                      variant="primary"
                      onPress={() => void chooseIconFile($, path, name)}
                    />
                    <Button
                      key={`auto-${i}`}
                      label={t(l, 'autoIcon')}
                      onPress={() => void pickIcon(path, '')}
                    />
                  </Box>
                  <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
                    {EMOJI_CHOICES.map((choice, k) => (
                      <Button
                        key={`emoji-${i}-${k}`}
                        label={choice}
                        plain
                        onPress={() => void pickIcon(path, choice)}
                      />
                    ))}
                  </Box>
                  {Input !== undefined && (
                    <Input
                      key={`icon-${i}`}
                      placeholder={t(l, 'otherEmoji')}
                      value={emoji}
                      submitLabel={t(l, 'save')}
                      onSubmit={value => void pickIcon(path, value)}
                    />
                  )}
                </Box>
              )}
            </Box>
          )
        })}
        <Text bold>{t(l, 'others')}</Text>
        {others.map((p, i) => (
          <Box key={`other-${i}`} flexDirection="row" alignItems="center">
            <Button
              key={`pin-${i}`}
              label="📌"
              plain
              onPress={async () => savePinned($, [...(await read($, pinned)), p.path])}
            />
            {sessionCount(iconEls, p, l)}
            <Text wrap="truncate">{p.name}</Text>
          </Box>
        ))}
      </Box>
    )
  })
}
