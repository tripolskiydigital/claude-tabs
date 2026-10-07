# Claude Tabs — project tabs for Claude Desktop

**English** · [Русский](docs/README.ru.md)

![Project tabs above the prompt in Claude Desktop](docs/screenshots/tabs.png)

A mod for the **Code tab of Claude Desktop** (macOS) that turns your projects into horizontal tabs above the prompt, like browser tabs:

- **Pinned projects as tabs**, each with its icon: the project's own favicon, an emoji, a picture you choose, or a colored letter.
- **One click opens the project's last session**, the one you were in most recently. A project with no session yet opens a new one in its folder.
- **⌃1…⌃9 (or ⌘1…⌘9) switch tabs** while Claude is in front.
- **Live session status**, colored like the desktop's sidebar dots: the session count on each tab turns amber when a session **waits for you** (a permission or a question), blue when one **finished and is unread**, grey while one **runs**.
- **Hover a tab** to see its 5 most recent sessions with their status dots, and jump straight to any of them.
- **A settings pane** (the `⋯` button or `/tabs`): keyboard shortcuts, pin and unpin projects, reorder them, pick icons (file picker, emoji, or automatic), refresh icons.
- **Speaks your language**: English, Deutsch, Français, Italiano, Español, Українська, Русский, following Claude Desktop's own language setting; English for every other language.

It is built on Claude Code's **mods** (plugins of function hooks), so it does not patch the Claude app: updates of Claude don't break it, and removing the plugin removes it.

<p>
  <img src="docs/screenshots/hover.png" alt="Hovering a tab shows its recent sessions with status dots" width="64%">
  <img src="docs/screenshots/pane.png" alt="The settings pane: shortcuts, pinned projects, icons" width="34%">
</p>

<sub>Demo projects. The tabs, icons, counts and dots are drawn by the mod's own code; [docs/demo/render.ts](docs/demo/render.ts) renders these pictures.</sub>

## Requirements

- **macOS** and **Claude Desktop** with mods support (Claude Code engine 2.1.289 or later, shipped with Claude Desktop 2.26454 and later).
- For keyboard shortcuts: Xcode Command Line Tools (`xcode-select --install`), to build the small helper that listens for the keys.
- The mod draws in Claude Desktop's Code tab. It also loads in the terminal `claude`, where it draws a simpler text version of the tabs.

## Install

### From the marketplace (recommended)

```bash
claude plugin marketplace add tripolskiydigital/claude-tabs
```

```bash
claude plugin install project-tabs@claude-tabs
```

Then open a new session in Claude Desktop (or quit Claude with ⌘Q and open it again for sessions that were already open). To update later:

```bash
claude plugin update project-tabs@claude-tabs
```

### From a clone

```bash
git clone https://github.com/tripolskiydigital/claude-tabs.git ~/claude-tabs
```

Then add the folder to `env` in `~/.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "/Users/you/claude-tabs"
  }
}
```

Use one way or the other, not both: with both, the mod loads twice.

## Using it

1. Click **📌 Pin this project** in the band above the prompt, or open the pane with `⋯` and pin projects from the list. The list shows every folder that has had a Code session in Claude Desktop.
2. Click a tab to open that project's last session. Hover it for its recent sessions.
3. In the pane, **✎** opens a project's icon editor: **Choose file…** (PNG, JPG, SVG and the rest; pictures are scaled to 64px and copied, so moving the original is fine), **Automatic**, or an emoji. **Refresh icons** looks for favicons again.

The icon is found automatically when the project has one: `favicon.svg/png/ico`, `icon.svg/png`, `apple-touch-icon.png`, in the project root, `public/`, `app/`, `static/` or `assets/`, up to four folders deep (monorepos included). To set your own without the pane, put `.claude/icon.svg` or `.claude/icon.png` in the project.

### Keyboard shortcuts

Shortcuts are off until you switch them on: in the pane, **Keyboard shortcuts** → **⌃1–9** or **⌘1–9**. The tabs then show their number, and ⌃1 opens the first pinned project's last session, ⌃2 the second, up to 9.

A mod can't bind keys in Claude Desktop itself, so switching shortcuts on builds a tiny helper (`helper/tabs-hotkeys.swift`, about 100 lines) and runs it with launchd as `com.github.tripolskiydigital.claude-tabs.hotkeys`. It holds the keys **only while Claude Desktop is the frontmost app**; in any other app ⌃1…⌃9 do what they always did. It needs no Accessibility or other permissions. **Off** stops it and removes it from launchd.

⌘1–⌘3 are Claude Desktop's own shortcuts (new chat, task, code session); the ⌘ variant takes them over while it is on. If ⌃1…⌃9 switch desktops on your Mac (System Settings → Keyboard → Keyboard Shortcuts → Mission Control), use ⌘ or turn those off.

## How it works

Everything stays on your Mac; the mod makes no network requests.

| What | Where it comes from |
| --- | --- |
| Projects and their sessions | `~/Library/Application Support/Claude/claude-code-sessions/**/local_*.json`, the desktop's own session records (folder, title, last focus) |
| Live status (running, waiting, finished) | `~/.claude/sessions/*.json`, written by every running Claude Code process |
| Interface language | the `locale` field of `~/Library/Application Support/Claude/config.json`, picked out by `grep`: the mod never reads the file itself, which also holds account data |
| Switching sessions | the desktop's deep link `claude://code/continue?session=…`, opened with `open` |
| Pins and chosen icons | the plugin's own store; chosen icon files are copied to `~/.claude/project-tabs/icons/` |
| Keyboard shortcuts | `~/.claude/project-tabs/hotkeys.json` (which tab leads where), read by the helper in `~/.claude/project-tabs/bin/` |

"Unread" means the session finished after you last looked at it. The mod polls these files every 4 seconds, reading only the ones that changed.

## Limits

- Mods can't change the app's own window: the tabs live above the prompt of each session, and the sidebar stays.
- Session status comes from processes running on this Mac; a session whose process has ended shows no status.
- The look follows Claude Desktop's current UI; a large redesign of the app may need an update of the mod.

## Uninstall

Switch keyboard shortcuts **Off** in the pane first (it removes the helper from launchd), then:

```bash
claude plugin uninstall project-tabs@claude-tabs
```

The mod's files are in `~/.claude/project-tabs/`; delete the folder to remove chosen icons and the helper.

## Development

```bash
claude plugin validate .
```

```bash
claude plugin test .
```

The module is `hooks/register.tsx`, helpers are in `hooks/lib.ts` and `hooks/hotkeys.ts`, translations in `hooks/i18n.ts`, the state contract in `types/index.d.ts`, the shortcut helper in `helper/tabs-hotkeys.swift`. The types of the mod API are written by Claude Code into `.claude-plugin/types/` when it loads the plugin. To iterate with hot reload, ask Claude in a Code session to work on the mod with the `plugin-authoring` skill, pointing the session's mods folder at your clone.

Issues and pull requests are welcome.

## License

[Apache 2.0](LICENSE)
