import { expect, mock, test } from 'claude-code/testing'

const HOME = '/Users/t'
const ROOT = `${HOME}/Library/Application Support/Claude/claude-code-sessions`
const DIR = `${ROOT}/acct/org`

const SESSIONS: Record<string, object> = {
  'local_a1.json': {
    sessionId: 'local_a1',
    cliSessionId: 'cli-a1',
    originCwd: '/p/alpha',
    lastFocusedAt: 100,
  },
  'local_b1.json': { sessionId: 'local_b1', originCwd: '/p/beta', lastFocusedAt: 300 },
  'local_b2.json': { sessionId: 'local_b2', originCwd: '/p/beta', lastFocusedAt: 200 },
  'local_b3.json': { sessionId: 'local_b3', originCwd: '/p/beta', lastFocusedAt: 900, isArchived: true },
}

const BAND = {
  plugin: 'project-tabs',
  component: 'AbovePrompt',
  props: { hasSurvey: false, isWorking: false, maxRows: 4, bodyColumns: 100 } as never,
} as const

test('a pinned tab opens the last live session of its project', async ($, on) => {
  const opened: string[] = []
  mock.env(on, { HOME })
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  mock.store(on, { pinned: ['/p/alpha', '/p/beta', '/p/gamma'] })
  on('session.id', () => ({ value: 'cli-a1' }))
  on('session.cwd', () => ({ value: '/p/alpha' }))
  on('fs.exists', () => ({ value: false }))
  on('fs.list', ($, e) => {
    const dir = (name: string) => ({ name, kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false })
    if (e.path === ROOT) return { value: [dir('acct')] }
    if (e.path === `${ROOT}/acct`) return { value: [dir('org')] }
    if (e.path === DIR) {
      const files = Object.keys(SESSIONS).map(name => ({
        name,
        kind: 'file' as const,
        size: 1,
        mtimeMs: 1,
        isLink: false,
      }))
      return { value: files }
    }
    return { value: [] }
  })
  on('fs.read', ($, e) => ({ value: JSON.stringify(SESSIONS[e.path.slice(DIR.length + 1)]) }))
  on('process.run', ($, e) => {
    opened.push(e.argv.join(' '))
    return {
      value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
    }
  })

  await $.command.run({ command: 'tabs', args: '' } as never)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ key: 'open-0' })).toBeDefined()

    // beta's newest live session is b1: b3 is newer but archived.
    await ui.press({ key: 'open-1' })
    // gamma has no session yet: a new one opens in its folder.
    await ui.press({ key: 'open-2' })
    // alpha is where this session is: nothing opens.
    await ui.press({ key: 'open-0' })
    await ui.unmount()
  }

  expect(opened).toEqual([
    'open claude://code/continue?session=local_b1&source=project-tabs',
    'open claude://code/new?folder=%2Fp%2Fgamma&source=project-tabs',
    'open claude://code/continue?session=local_b1&source=project-tabs',
    'open claude://code/new?folder=%2Fp%2Fgamma&source=project-tabs',
  ])
})

test('with nothing pinned the band offers to pin this project', async ($, on) => {
  mock.env(on, { HOME })
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  mock.store(on)
  on('session.id', () => ({ value: 'cli-x' }))
  on('session.cwd', () => ({ value: '/p/here' }))
  on('fs.exists', () => ({ value: false }))
  on('fs.list', () => ({ value: [] }))

  await $.command.run({ command: 'tabs', args: '' } as never)

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'pin-current' })
  expect(await ui.find({ key: 'open-0' })).toBeDefined()
  await ui.unmount()
})

test('live statuses color the counts, and a recent session opens itself', async ($, on) => {
  const opened: string[] = []
  mock.env(on, { HOME })
  mock.store(on, { pinned: ['/p/alpha', '/p/beta'] })
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('session.id', () => ({ value: 'cli-a1' }))
  on('session.cwd', () => ({ value: '/p/alpha' }))
  on('fs.exists', () => ({ value: false }))

  const LIVE: Record<string, object> = {
    '11.json': { pid: 11, hostSessionId: 'local_b1', status: 'waiting', statusUpdatedAt: 400 },
    '12.json': { pid: 12, hostSessionId: 'local_b2', status: 'idle', statusUpdatedAt: 10_000 },
    '13.json': { pid: 13, hostSessionId: 'local_a1', status: 'idle', statusUpdatedAt: 10_000 },
    '14.json': { pid: 14, hostSessionId: 'local_b3', status: 'busy', statusUpdatedAt: 10_000 },
  }
  const file = (name: string) => ({ name, kind: 'file' as const, size: 1, mtimeMs: 1, isLink: false })
  const dir = (name: string) => ({ name, kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false })
  on('fs.list', ($, e) => {
    if (e.path === ROOT) return { value: [dir('acct')] }
    if (e.path === `${ROOT}/acct`) return { value: [dir('org')] }
    if (e.path === DIR) return { value: Object.keys(SESSIONS).map(file) }
    if (e.path === `${HOME}/.claude/sessions`) return { value: Object.keys(LIVE).map(file) }
    return { value: [] }
  })
  on('fs.read', ($, e) => {
    const name = e.path.split('/').at(-1)!
    return { value: JSON.stringify(e.path.startsWith(DIR) ? SESSIONS[name] : LIVE[name]) }
  })
  on('process.run', ($, e) => {
    // pid 14 is gone: its file outlived it.
    const stdout = e.argv[0] === 'ps' ? '11\n12\n13\n' : ''
    if (e.argv[0] === 'open') opened.push(e.argv[1]!)
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })

  await $.command.run({ command: 'tabs', args: '' } as never)

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  // beta: b1 waits, b2 finished after it was last focused (200), b3 is archived.
  // beta's two live sessions (b3 is archived) counted in the color of the most
  // urgent: b1 waits. alpha's only session is this one, in view: never unread.
  const counts = JSON.stringify(await ui.drawn()).match(/"alt":"\d+ [^"]*"/g)
  expect(counts).toEqual(['"alt":"1 quiet"', '"alt":"2 waiting for you"'])

  // The newest active session of beta comes first in its list.
  await ui.press({ key: 'session-1-0' })
  await ui.press({ key: 'session-1-1' })
  await ui.unmount()

  expect(opened).toEqual([
    'claude://code/continue?session=local_b2&source=project-tabs',
    'claude://code/continue?session=local_b1&source=project-tabs',
  ])
})

test('the ⋯ button opens the pane, and a second press closes it', async ($, on) => {
  const calls: string[] = []
  let isOpen = false
  mock.env(on, { HOME })
  mock.store(on, { pinned: ['/p/alpha'] })
  on('session.id', () => ({ value: 'cli-a1' }))
  on('session.cwd', () => ({ value: '/p/alpha' }))
  on('fs.exists', () => ({ value: false }))
  on('fs.list', () => ({ value: [] }))
  on('ui.panes', () => ({
    value: isOpen ? [{ id: 'project-tabs', title: '', isShown: true, isFocused: true, isPlaced: true }] : [],
  }))
  on('ui.open', () => {
    calls.push('open')
    isOpen = true
    return { value: { isPlaced: true as const } }
  })
  on('ui.close', () => {
    calls.push('close')
    isOpen = false
    return { value: undefined }
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.press({ key: 'manage' })
  await ui.press({ key: 'manage' })
  await ui.unmount()

  expect(calls).toEqual(['open', 'close'])
})

test('the pane speaks the language of the desktop and keeps a chosen icon in the store', async ($, on) => {
  const runs: string[][] = []
  mock.env(on, { HOME, TMPDIR: '/var/folders/x/T/' })
  mock.store(on, { pinned: ['/p/alpha'] })
  on('session.id', () => ({ value: 'cli-a1' }))
  on('session.cwd', () => ({ value: '/p/alpha' }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('fs.exists', () => ({ value: false }))
  on('fs.list', () => ({ value: [] }))
  const CONFIG = `${HOME}/Library/Application Support/Claude/config.json`
  on('fs.stat', ($, e) =>
    e.path === CONFIG || e.path.endsWith('.png')
      ? { value: { kind: 'file' as const, size: 900, mtimeMs: 1, isLink: false } }
      : { deny: 'missing' },
  )
  // The settings file is never read by the mod: only grep's one pair reaches it.
  on('fs.read', ($, e) =>
    e.path === CONFIG ? { deny: 'the mod must not read config.json' } : { value: { base64: 'iVBORw0KGgo=' } },
  )
  const writes: string[] = []
  on('fs.write', ($, e) => {
    writes.push(e.path)
    return { value: undefined }
  })
  on('process.run', ($, e) => {
    runs.push([...e.argv])
    const stdout =
      e.argv[0] === 'osascript'
        ? '/Users/t/Pictures/logo.jpg\n'
        : e.argv[0] === 'grep' && e.argv.at(-1) === CONFIG
          ? '"locale": "de-DE"\n'
          : ''
    return { value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })

  await $.command.run({ command: 'tabs', args: '' } as never)
  const pane = await $.ui.mount({
    plugin: 'project-tabs',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'project-tabs',
    props: {} as never,
  })
  expect(await pane.find({ key: 'reload-icons' })).toMatchObject({
    props: { label: 'Symbole aktualisieren' },
  })

  await pane.press({ key: 'edit-0' })
  await pane.press({ key: 'file-0' })
  await pane.unmount()

  // The dialog is the plugin's own script file, run with the prompt as its one argument.
  const dialog = runs.find(argv => argv[0] === 'osascript')
  expect(dialog?.[1]).toMatch(/\/helper\/choose-icon\.applescript$/)
  expect(dialog?.slice(2)).toEqual(['Symbol für „alpha“'])

  const target = runs.find(argv => argv[0] === 'sips')
  expect(target?.slice(0, 6)).toEqual(['sips', '-s', 'format', 'png', '-Z', '64'])
  expect(target?.[6]).toBe('/Users/t/Pictures/logo.jpg')
  expect(target?.[8]).toBe('/var/folders/x/T/claude-tabs-icon.png')
  // The scaled picture goes to the plugin's store as a data URI: the mod writes no file.
  expect(writes).toEqual([])
  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(JSON.stringify(await band.drawn())).toContain('data:image/png;base64,iVBORw0KGgo=')
  await band.unmount()
})

test('switching on ⌃1–9 maps the tabs for the agent, starts it and numbers the tabs', async ($, on) => {
  const runs: string[] = []
  const writes: Record<string, string> = {}
  mock.env(on, { HOME })
  mock.store(on, { pinned: ['/p/beta', '/p/gamma'] })
  on('session.id', () => ({ value: 'cli-a1' }))
  on('session.cwd', () => ({ value: '/p/alpha' }))
  on('ui.open', () => ({ value: { isPlaced: true as const } }))
  on('fs.exists', () => ({ value: false }))
  const dir = (name: string) => ({ name, kind: 'dir' as const, size: 0, mtimeMs: 0, isLink: false })
  on('fs.list', ($, e) => {
    if (e.path === ROOT) return { value: [dir('acct')] }
    if (e.path === `${ROOT}/acct`) return { value: [dir('org')] }
    if (e.path === DIR) {
      const files = Object.keys(SESSIONS).map(name => ({
        name,
        kind: 'file' as const,
        size: 1,
        mtimeMs: 1,
        isLink: false,
      }))
      return { value: files }
    }
    return { value: [] }
  })
  on('fs.read', ($, e) =>
    e.path.startsWith(DIR)
      ? { value: JSON.stringify(SESSIONS[e.path.slice(DIR.length + 1)]) }
      : { deny: 'missing' },
  )
  // The helper's source and an up-to-date build of it: no compile needed.
  on('fs.stat', ($, e) =>
    e.path.endsWith('tabs-hotkeys.swift') || e.path.endsWith('project-tabs/tabs-hotkeys')
      ? { value: { kind: 'file' as const, size: 1, mtimeMs: 5, isLink: false } }
      : { deny: 'missing' },
  )
  on('fs.write', ($, e) => {
    writes[e.path] = e.text
    return { value: undefined }
  })
  let isLoaded = false
  on('process.run', ($, e) => {
    runs.push(e.argv.join(' '))
    const ok = (stdout = '') => ({
      value: { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false },
    })
    if (e.argv[1] === 'list') return isLoaded ? ok() : { value: { ...ok().value, exitCode: 113 } }
    if (e.argv[1] === 'submit') isLoaded = true
    return ok()
  })

  await $.command.run({ command: 'tabs', args: '' } as never)
  const pane = await $.ui.mount({
    plugin: 'project-tabs',
    surface: 'desktop',
    component: 'Pane',
    requestId: 'project-tabs',
    props: {} as never,
  })
  await pane.press({ key: 'hotkeys-control' })
  await pane.unmount()

  const config = JSON.parse(writes[`${HOME}/.claude/project-tabs/hotkeys.json`] ?? '{}')
  expect(config.modifier).toBe('control')
  expect(config.targets.slice(0, 3)).toEqual([
    'claude://code/continue?session=local_b1&source=project-tabs',
    'claude://code/new?folder=%2Fp%2Fgamma&source=project-tabs',
    null,
  ])
  // launchd runs the helper with no file of its own: nothing goes to ~/Library/LaunchAgents.
  expect(runs).toContain(
    `launchctl submit -l com.github.tripolskiydigital.claude-tabs.hotkeys -- ${HOME}/.claude/project-tabs/tabs-hotkeys`,
  )
  expect(Object.keys(writes).some(path => path.includes('LaunchAgents'))).toBe(false)
  expect(runs.some(run => run.startsWith('swiftc'))).toBe(false)

  const band = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const alts = JSON.stringify(await band.drawn()).match(/"alt":"⌃\d"/g)
  expect(alts).toEqual(['"alt":"⌃1"', '"alt":"⌃2"'])
  await band.unmount()
})
