/**
 * The plain parts of the tab shortcuts: where the agent's files live. The
 * calls that build and run it are in register.tsx, since `$` never crosses an
 * import.
 */

/** The launchd job (`launchctl submit`, no file of its own) that runs helper/tabs-hotkeys.swift. */
export const AGENT_LABEL = 'com.github.tripolskiydigital.claude-tabs.hotkeys'

export type AgentResult = { isOk: true; isRebuilt?: boolean } | { isOk: false; error: string }

export type HotkeyPaths = {
  /** Which tab leads where: written by the mod, read by the agent. */
  config: string
  /** The agent, as swiftc builds it. */
  binary: string
  /** The agent's Swift source, shipped with the plugin. */
  source: string
  /**
   * A VFS overlay shipped with the plugin, for Command Line Tools that ship one
   * Swift module map twice (every Swift build fails there): it maps the
   * duplicate onto the empty file beside it, for that one build.
   */
  overlay: string
}

export function hotkeyPaths(home: string, pluginRoot: string): HotkeyPaths {
  const base = `${home}/.claude/project-tabs`
  return {
    config: `${base}/hotkeys.json`,
    binary: `${base}/tabs-hotkeys`,
    source: `${pluginRoot}/helper/tabs-hotkeys.swift`,
    overlay: `${pluginRoot}/helper/build/overlay.yaml`,
  }
}

export function lastLine(text: string): string {
  return text.trim().split('\n').at(-1) ?? text
}
