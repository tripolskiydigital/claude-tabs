import type { Project, SessionState, SessionSummary } from '../types'

/** One desktop session, as its metadata file under claude-code-sessions holds it. */
export type SessionMeta = {
  sessionId: string
  cliSessionId: string | null
  path: string
  title: string
  lastFocusedAt: number
  lastActivityAt: number
  isArchived: boolean
}

/** A running Claude Code process, as its file under ~/.claude/sessions says. */
export type LiveSession = {
  pid: number
  /** The desktop session it serves (`local_...`). */
  hostSessionId: string
  status: 'busy' | 'idle' | 'waiting'
  statusUpdatedAt: number
}

export function parseSession(text: string): SessionMeta | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  const sessionId = typeof o.sessionId === 'string' ? o.sessionId : null
  const path = typeof o.originCwd === 'string' ? o.originCwd : typeof o.cwd === 'string' ? o.cwd : null
  if (sessionId === null || path === null || !/^local_[A-Za-z0-9-]{1,64}$/.test(sessionId)) {
    return null
  }
  const num = (...values: unknown[]) => values.find((t): t is number => typeof t === 'number') ?? 0
  return {
    sessionId,
    cliSessionId: typeof o.cliSessionId === 'string' ? o.cliSessionId : null,
    path: path.replace(/\/+$/, ''),
    title: typeof o.title === 'string' && o.title.trim() !== '' ? o.title.trim() : baseName(path),
    lastFocusedAt: num(o.lastFocusedAt, o.lastActivityAt, o.createdAt),
    lastActivityAt: num(o.lastActivityAt, o.lastFocusedAt, o.createdAt),
    isArchived: o.isArchived === true,
  }
}

export function parseLive(text: string): LiveSession | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  const status = o.status
  if (
    typeof o.pid !== 'number' ||
    typeof o.hostSessionId !== 'string' ||
    (status !== 'busy' && status !== 'idle' && status !== 'waiting')
  ) {
    return null
  }
  return {
    pid: o.pid,
    hostSessionId: o.hostSessionId,
    status,
    statusUpdatedAt: typeof o.statusUpdatedAt === 'number' ? o.statusUpdatedAt : 0,
  }
}

/**
 * What a session wants, as the desktop's sidebar dot says it: waiting on the
 * person (a permission or a question), finished since it was last looked at,
 * or running. The session this band is drawn in is never unread: it is in view.
 */
export function stateOf(
  meta: SessionMeta,
  live: LiveSession | undefined,
  ownSessionId: string | null,
): SessionState {
  if (live === undefined) return 'idle'
  if (live.status === 'waiting') return 'waiting'
  if (live.status === 'busy') return 'running'
  const isUnseen = live.statusUpdatedAt > meta.lastFocusedAt + UNREAD_SLACK_MS
  return isUnseen && meta.sessionId !== ownSessionId ? 'unread' : 'idle'
}

/** Focus written a moment before the turn's end still counts as seen. */
const UNREAD_SLACK_MS = 2_000

/** The most urgent first. */
export const STATES = ['waiting', 'unread', 'running'] as const

export function baseName(path: string): string {
  return path.split('/').filter(Boolean).at(-1) ?? path
}

export const RECENT_COUNT = 5

/**
 * Groups sessions by project folder, most recently focused project first: each
 * with its last focused session, its most recently active ones, and how many
 * of them wait, are unread or run.
 */
export function groupProjects(
  sessions: readonly SessionMeta[],
  live: ReadonlyMap<string, LiveSession> = new Map(),
  ownSessionId: string | null = null,
): Project[] {
  const byPath = new Map<string, { project: Project; active: (SessionSummary & { at: number })[] }>()
  for (const s of sessions) {
    const entry = byPath.get(s.path) ?? {
      project: {
        path: s.path,
        name: baseName(s.path),
        lastSessionId: null,
        lastFocusedAt: 0,
        sessionCount: 0,
        recent: [],
        counts: { waiting: 0, unread: 0, running: 0 },
      },
      active: [],
    }
    byPath.set(s.path, entry)
    if (s.isArchived) continue
    const p = entry.project
    p.sessionCount += 1
    if (p.lastSessionId === null || s.lastFocusedAt > p.lastFocusedAt) {
      p.lastSessionId = s.sessionId
      p.lastFocusedAt = s.lastFocusedAt
    }
    const l = live.get(s.sessionId)
    const state = stateOf(s, l, ownSessionId)
    if (state !== 'idle') p.counts[state] += 1
    const at = Math.max(s.lastActivityAt, s.lastFocusedAt, l?.statusUpdatedAt ?? 0)
    entry.active.push({ id: s.sessionId, title: s.title, state, at })
  }
  return [...byPath.values()]
    .map(({ project, active }) => ({
      ...project,
      recent: active
        .sort((a, b) => b.at - a.at)
        .slice(0, RECENT_COUNT)
        .map(({ id, title, state }) => ({ id, title, state })),
    }))
    .sort((a, b) => b.lastFocusedAt - a.lastFocusedAt)
}

export function sessionUrl(sessionId: string): string {
  return `claude://code/continue?session=${sessionId}&source=project-tabs`
}

/** The deep link a tab opens: the project's last session, or a new one in its folder. */
export function tabUrl(project: Pick<Project, 'path' | 'lastSessionId'>): string {
  return project.lastSessionId !== null
    ? sessionUrl(project.lastSessionId)
    : `claude://code/new?folder=${encodeURIComponent(project.path)}&source=project-tabs`
}

/** An icon the person put in the project for this mod, before any favicon. */
export const OVERRIDE_CANDIDATES = ['.claude/icon.svg', '.claude/icon.png'] as const

/** Folders a favicon never lives in, or that are too big to walk. */
export const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.nuxt',
  '.svelte-kit',
  '.turbo',
  '.cache',
  '.vercel',
  'dist',
  'build',
  'out',
  'coverage',
  'vendor',
  'target',
  'Pods',
  '.venv',
  'venv',
  '__pycache__',
  'legacy',
  'tmp',
])

const ICON_NAME = /^(?:favicon(?:-\d+x\d+)?|icon|apple-touch-icon|apple-icon)\.(svg|png|ico)$/i

/**
 * How good a file is as the project's icon, lower is better; undefined when it
 * is none. SVG beats PNG beats ICO, a shallower file beats a deeper one, and a
 * file in a web root (public, app, static) beats one elsewhere.
 */
export function iconRank(relPath: string): number | undefined {
  const parts = relPath.split('/')
  const file = parts.at(-1) ?? ''
  const ext = ICON_NAME.exec(file)?.[1]?.toLowerCase()
  if (ext === undefined) return undefined
  const byExt = ext === 'svg' ? 0 : ext === 'png' ? 1 : 2
  const byName = file.toLowerCase().startsWith('favicon') ? 0 : 1
  const dir = parts.at(-2)
  const inWebRoot = dir === undefined || ['public', 'app', 'static', 'assets'].includes(dir)
  return (parts.length - 1) * 10 + (inWebRoot ? 0 : 5) + byExt * 2 + byName
}

const MIME: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  ico: 'image/x-icon',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
}

export function mimeOf(path: string): string | undefined {
  return MIME[path.split('.').at(-1)?.toLowerCase() ?? '']
}

/** A data URI of an image file's bytes, what an icon draws. */
export function dataUri(base64: string, mime: string): string {
  return `data:${mime};base64,${base64}`
}

/** The tab's icon box: 20px inside 4px of padding, 28px in all. */
export const TAB_HEIGHT = 28
const PAD = 4
const ICON = 20
/**
 * The desktop rounds a Box's background about 6px; strictly concentric, 4px in,
 * the icon would take 2px, which reads square. 6px sits better beside it.
 */
const RADIUS = 6

const svgOpen = (width: number, height: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`

export type IconSource =
  { kind: 'image'; uri: string } | { kind: 'emoji'; text: string } | { kind: 'letter'; name: string }

/** The tab's icon, padded to the tab's height: an image, an emoji, or the name's letter on a square. */
export function tabIconSvg(icon: IconSource): string {
  const box = `x="${PAD}" y="${PAD}" width="${ICON}" height="${ICON}"`
  const mid = PAD + ICON / 2
  let body: string
  if (icon.kind === 'image') {
    body =
      `<defs><clipPath id="r"><rect ${box} rx="${RADIUS}"/></clipPath></defs>` +
      `<image href="${icon.uri}" ${box} preserveAspectRatio="xMidYMid meet" clip-path="url(#r)"/>`
  } else if (icon.kind === 'emoji') {
    body = `<text x="${mid}" y="${mid}" font-size="14" text-anchor="middle" dominant-baseline="central">${escapeXml(icon.text)}</text>`
  } else {
    body =
      `<rect ${box} rx="${RADIUS}" fill="${letterColor(icon.name)}"/>` +
      `<text x="${mid}" y="${mid}" font-size="12" font-weight="600" font-family="-apple-system, Helvetica, Arial, sans-serif" text-anchor="middle" dominant-baseline="central" fill="#fff">${escapeXml(letterOf(icon.name))}</text>`
  }
  return `${svgOpen(PAD + ICON + PAD, TAB_HEIGHT)}${body}</svg>`
}

/** How wide the tab's shortcut digit is drawn, with 6px before it. */
export const DIGIT_WIDTH = 16

/**
 * The tab's shortcut digit, dim, at the tab's height: 6px from the tab's edge,
 * then the icon's own 4px of padding after it.
 */
export function digitSvg(digit: number): string {
  const style = '<style>.d{fill:#8a8983}@media (prefers-color-scheme: dark){.d{fill:#8b8a84}}</style>'
  return (
    `${svgOpen(DIGIT_WIDTH, TAB_HEIGHT)}${style}` +
    `<text class="d" x="${DIGIT_WIDTH - 2}" y="${TAB_HEIGHT / 2}" font-size="12" font-weight="500" font-family="-apple-system, Helvetica, Arial, sans-serif" text-anchor="end" dominant-baseline="central">${digit}</text></svg>`
  )
}

/** The desktop's own dot colors (its CSS): light theme, then dark. */
const DOT_COLORS: Record<SessionState, [string, string]> = {
  waiting: ['#a66a00', '#c98500'],
  unread: ['#2a78d6', '#5598e7'],
  running: ['#8a8a86', '#77766f'],
  idle: ['#b5b4ad', '#5c5b56'],
}

export const DOT_ROW_HEIGHT = 26

const COUNT_IDLE: [string, string] = ['#73726c', '#9c9a92']

/**
 * The session count as a pill the height of the icon and of the name's own
 * highlight, ringed, its number in the state's color: 4px from the name and
 * 4px from the tab's edge, as the icon sits.
 */
export function countPillSvg(count: number, state: SessionState): string {
  const text = count > 999 ? '999+' : String(count)
  const pill = Math.max(ICON, 12 + Math.ceil(text.length * 7))
  const width = PAD + pill + PAD
  const [light, dark] = state === 'idle' ? COUNT_IDLE : DOT_COLORS[state]
  const style =
    `<style>.t{fill:${light}}.b{fill:none;stroke:rgba(0,0,0,0.16)}` +
    `@media (prefers-color-scheme: dark){.t{fill:${dark}}.b{stroke:rgba(255,255,255,0.16)}}</style>`
  return (
    `${svgOpen(width, TAB_HEIGHT)}${style}` +
    `<rect class="b" x="${PAD + 0.5}" y="${PAD + 0.5}" width="${pill - 1}" height="${ICON - 1}" rx="${RADIUS - 0.5}"/>` +
    `<text class="t" x="${PAD + pill / 2}" y="${TAB_HEIGHT / 2}" font-size="12" font-weight="600" font-family="-apple-system, Helvetica, Arial, sans-serif" text-anchor="middle" dominant-baseline="central">${text}</text></svg>`
  )
}

/** How wide the count pill is drawn, with its padding. */
export function countPillWidth(count: number): number {
  const text = count > 999 ? '999+' : String(count)
  return PAD + Math.max(ICON, 12 + Math.ceil(text.length * 7)) + PAD
}

/**
 * A session's dot as the sidebar draws it, at the height of a row of the list:
 * filled in its state's color (a running one pulses), a ring when idle.
 */
export function dotSvg(state: SessionState): string {
  const [light, dark] = DOT_COLORS[state]
  const paint = state === 'idle' ? 'fill:none;stroke:' : 'fill:'
  const style = `<style>.d{${paint}${light}}@media (prefers-color-scheme: dark){.d{${paint}${dark}}}</style>`
  const pulse =
    state === 'running'
      ? '<animate attributeName="opacity" values="1;0.35;1" dur="1.6s" repeatCount="indefinite"/>'
      : ''
  const cy = DOT_ROW_HEIGHT / 2
  return `${svgOpen(12, DOT_ROW_HEIGHT)}${style}<circle class="d" cx="6" cy="${cy}" r="${state === 'idle' ? 3.5 : 4}" stroke-width="1.5">${pulse}</circle></svg>`
}

function escapeXml(text: string): string {
  return text.replace(/[<>&"']/g, c => `&#${c.charCodeAt(0)};`)
}

const PALETTE = ['#d97757', '#6a9bcc', '#788c5d', '#b07cc6', '#c2a14a', '#5aa5a0', '#c76b8e', '#7d7fd1']

/** The fallback icon's color, picked from the project's name. */
export function letterColor(name: string): string {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.codePointAt(0)!) >>> 0
  return PALETTE[hash % PALETTE.length]!
}

/** The fallback icon's letter: the name's first letter or digit. */
export function letterOf(name: string): string {
  return (name.match(/[\p{L}\p{N}]/u)?.[0] ?? '?').toUpperCase()
}

/** An icon override is an image when it is a data URI or names a file; anything else is drawn as text. */
export function isImagePath(icon: string): boolean {
  return icon.startsWith('data:image/') || (/^(~|\/)/.test(icon) && mimeOf(icon) !== undefined)
}

/** Moves the entry at `index` by `delta` places, clamped to the list. */
export function move<T>(list: readonly T[], index: number, delta: number): T[] {
  const to = Math.max(0, Math.min(list.length - 1, index + delta))
  const out = [...list]
  const [item] = out.splice(index, 1)
  if (item !== undefined) out.splice(to, 0, item)
  return out
}

/** The state colors as text draws them, where no SVG carries a scheme. */
export const STATE_TEXT_COLORS: Record<SessionState, string> = {
  waiting: '#c98500',
  unread: '#3987e5',
  running: '#8a8a86',
  idle: '#8a8a86',
}

/** The most urgent state among a project's sessions. */
export function topState(counts: Project['counts']): SessionState {
  return STATES.find(st => counts[st] > 0) ?? 'idle'
}

/** Emoji offered as icons, one press each. */
export const EMOJI_CHOICES = [
  '🚀',
  '⭐',
  '🔥',
  '💡',
  '🛒',
  '📦',
  '🎨',
  '🎮',
  '🧪',
  '🤖',
  '📱',
  '🌐',
  '💰',
  '📊',
  '🍔',
  '🏠',
  '🎵',
  '📚',
  '⚙️',
  '🧩',
] as const
