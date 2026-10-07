/** The interface languages: the desktop's own, where the mod speaks it. */
export type Lang = 'en' | 'ru' | 'uk' | 'de' | 'fr' | 'it' | 'es'

/** Which key, with a digit, switches tabs while Claude Desktop is in front. */
export type HotkeyModifier = 'off' | 'control' | 'command'

/** What a session wants of the person, as the desktop's sidebar dot says it. */
export type SessionState = 'waiting' | 'unread' | 'running' | 'idle'

export type SessionSummary = { id: string; title: string; state: SessionState }

export type Project = {
  /** The project folder: the sessions' originCwd. */
  path: string
  name: string
  /** The most recently focused session that is not archived. */
  lastSessionId: string | null
  lastFocusedAt: number
  sessionCount: number
  /** The most recently active sessions that are not archived, newest first. */
  recent: SessionSummary[]
  /** How many of the project's sessions wait, are unread, run. */
  counts: { waiting: number; unread: number; running: number }
}

declare module 'claude-code' {
  interface PluginState {
    'project-tabs': {
      projects: Project[]
      pinned: string[]
      /** Per project path: an emoji, or a path to an image file. */
      icons: Record<string, string>
      /** Per project path: its icon image as a data URI, null when none was found. */
      favicons: Record<string, string | null>
      current: string
      /** The pinned project whose icon field is open in the pane. */
      editing: string | null
      /** The interface language, as the desktop's settings set it. */
      lang: Lang
      /** The tab shortcuts' modifier; 'off' when they are not set up. */
      hotkeys: HotkeyModifier
    }
  }
}
