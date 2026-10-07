/**
 * The plain parts of the tab shortcuts: where the agent's files live and what
 * they hold. The calls that build and run it are in register.tsx, since `$`
 * never crosses an import.
 */

/** The launchd job (`launchctl submit`, no file of its own) that runs helper/tabs-hotkeys.swift. */
export const AGENT_LABEL = 'com.github.tripolskiydigital.claude-tabs.hotkeys'

/** Command Line Tools that ship this module map twice fail every Swift build; a VFS overlay hides one. */
export const DUPLICATE_MODULEMAP = '/Library/Developer/CommandLineTools/usr/include/swift/module.modulemap'

export type AgentResult = { isOk: true; isRebuilt?: boolean } | { isOk: false; error: string }

export type HotkeyPaths = {
  base: string
  config: string
  binary: string
  build: string
  source: string
}

export function hotkeyPaths(home: string, pluginRoot: string): HotkeyPaths {
  const base = `${home}/.claude/project-tabs`
  return {
    base,
    config: `${base}/hotkeys.json`,
    binary: `${base}/bin/tabs-hotkeys`,
    build: `${base}/build`,
    source: `${pluginRoot}/helper/tabs-hotkeys.swift`,
  }
}

export function lastLine(text: string): string {
  return text.trim().split('\n').at(-1) ?? text
}

/** The VFS overlay that maps the duplicate module map onto an empty file. */
export function overlayJson(emptyModulemap: string): string {
  return JSON.stringify({
    version: 0,
    'case-sensitive': 'false',
    roots: [{ type: 'file', name: DUPLICATE_MODULEMAP, 'external-contents': emptyModulemap }],
  })
}
