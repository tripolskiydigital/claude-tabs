// Renders the README's screenshots with demo projects, and the plugin's icon.
//
// The icons, counts, shortcut digits and status dots come from the mod's own
// drawing code (hooks/lib.ts); the page around them follows Claude Desktop's
// dark theme. Run from the repository root:
//
//   node docs/demo/render.ts
//
// Needs Node 23.6+ (TypeScript type stripping) and Google Chrome.

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  DIGIT_WIDTH,
  TAB_HEIGHT,
  countPillSvg,
  countPillWidth,
  digitSvg,
  dotSvg,
  tabIconSvg,
} from '../../hooks/lib.ts'
import type { IconSource } from '../../hooks/lib.ts'

type State = 'waiting' | 'unread' | 'running' | 'idle'

type DemoProject = {
  name: string
  icon: IconSource
  sessions: number
  state: State
  recent: { title: string; state: State }[]
}

const svgUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`

/** Made-up favicons for the demo projects. */
const BAG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0f766e"/><path d="M9 12h14l-1.2 12H10.2z" fill="#ecfeff"/><path d="M12.5 12v-1.5a3.5 3.5 0 0 1 7 0V12" stroke="#ecfeff" stroke-width="2" fill="none"/></svg>`
const KITE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#f59e0b"/><path d="M16 5l8 9-8 13-8-13z" fill="#fff7ed"/><path d="M16 5v22M8 14h16" stroke="#f59e0b" stroke-width="1.6"/></svg>`

const PROJECTS: DemoProject[] = [
  {
    name: 'northwind-shop',
    icon: { kind: 'image', uri: svgUri(BAG) },
    sessions: 3,
    state: 'idle',
    recent: [
      { title: 'Checkout: add Apple Pay', state: 'idle' },
      { title: 'Product page image zoom', state: 'idle' },
      { title: 'Fix cart badge count', state: 'idle' },
    ],
  },
  {
    name: 'Lumen Docs',
    icon: { kind: 'letter', name: 'Lumen Docs' },
    sessions: 4,
    state: 'waiting',
    recent: [
      { title: 'Approve migration for the search index', state: 'waiting' },
      { title: 'Fix broken links in the API reference', state: 'unread' },
      { title: 'Dark mode for the docs theme', state: 'idle' },
      { title: 'Translate the getting-started guide', state: 'idle' },
    ],
  },
  {
    name: 'orbit-api',
    icon: { kind: 'emoji', text: '🚀' },
    sessions: 2,
    state: 'unread',
    recent: [
      { title: 'Rate limiting for public endpoints', state: 'unread' },
      { title: 'OpenAPI schema cleanup', state: 'idle' },
    ],
  },
  {
    name: 'paperkite',
    icon: { kind: 'image', uri: svgUri(KITE) },
    sessions: 5,
    state: 'running',
    recent: [{ title: 'Offline sync for drafts', state: 'running' }],
  },
  {
    name: 'Atlas Mobile',
    icon: { kind: 'letter', name: 'Atlas Mobile' },
    sessions: 1,
    state: 'idle',
    recent: [{ title: 'Onboarding screens', state: 'idle' }],
  },
]

const OTHERS: DemoProject[] = [
  { name: 'brightline-crm', icon: { kind: 'letter', name: 'brightline-crm' }, sessions: 6, state: 'idle', recent: [] },
  { name: 'tidepool', icon: { kind: 'letter', name: 'tidepool' }, sessions: 2, state: 'idle', recent: [] },
  { name: 'Quill Notes', icon: { kind: 'letter', name: 'Quill Notes' }, sessions: 3, state: 'unread', recent: [] },
  { name: 'ember-analytics', icon: { kind: 'letter', name: 'ember-analytics' }, sessions: 1, state: 'idle', recent: [] },
]

const ACTIVE = 0
const HOVERED = 1

const img = (svg: string, width: number, height: number) =>
  `<img src="${svgUri(svg)}" width="${width}" height="${height}" alt="">`

const escape = (text: string) => text.replace(/[<>&]/g, c => `&#${c.charCodeAt(0)};`)

const CSS = `
* { box-sizing: border-box; }
html, body { margin: 0; background: #151515; color: #e8e6e3; color-scheme: dark;
  font: 14px/1.45 -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased; }
img { display: block; }
.frame { padding: 22px 26px 26px; }
.reply { color: #d4d2cc; font-size: 15px; line-height: 1.6; max-width: 820px; margin: 0 0 18px 6px; }
.reply code { font: 13px ui-monospace, SFMono-Regular, Menlo, monospace; background: #232322; padding: 1px 5px; border-radius: 5px; }
.band { background: #212121; border-radius: 14px; padding: 9px 10px; display: flex; align-items: center; justify-content: space-between; }
.tabs { display: flex; gap: 8px; align-items: center; }
.tab { position: relative; display: flex; align-items: center; height: ${TAB_HEIGHT}px; border-radius: 6px; }
.tab.active { background: #151515; }
.tab.hover { background: rgba(128,128,128,0.14); }
.tab .name { color: #8f8e89; padding: 0 6px; font-size: 14px; white-space: nowrap; }
.tab.active .name, .tab.hover .name { color: #ecebe7; }
.more { background: #2b2b2a; color: #d5d3ce; border-radius: 8px; padding: 2px 12px; font-size: 16px; letter-spacing: 1px; }
.prompt { margin-top: 10px; border: 1px solid #343433; border-radius: 16px; background: #1d1d1d; height: 96px; padding: 14px 18px; color: #6f6e69; font-size: 15px; }
.popover { position: absolute; left: 0; bottom: ${TAB_HEIGHT + 8}px; background: #1d1d1d; border: 1px solid #3a3a39; border-radius: 12px; padding: 10px 14px 10px 12px; min-width: 360px; box-shadow: 0 10px 30px rgba(0,0,0,.45); }
.popover .title { color: #8f8e89; margin: 0 0 4px 2px; }
.row { display: flex; align-items: center; height: 30px; gap: 8px; }
.row .t { color: #e8e6e3; padding: 3px 8px; border-radius: 6px; white-space: nowrap; }
.row.hl .t { background: #2b2b2a; }
.pane { width: 470px; background: #191918; border-left: 1px solid #2a2a29; min-height: 100vh; padding: 0 22px 24px; }
.pane .head { display: flex; align-items: center; justify-content: space-between; height: 52px; border-bottom: 1px solid #262625; margin: 0 -22px 14px; padding: 0 22px; color: #d5d3ce; font-weight: 600; }
.pane .x { color: #8f8e89; font-weight: 400; font-size: 18px; }
.section { display: flex; align-items: center; justify-content: space-between; margin: 16px 0 8px; font-weight: 650; }
.btn { background: #2b2b2a; color: #e3e1dc; border-radius: 9px; padding: 5px 12px; font-weight: 500; font-size: 13.5px; }
.btn.primary { background: #ecebe7; color: #1a1a19; }
.btns { display: flex; gap: 6px; }
.prow { display: flex; align-items: center; justify-content: space-between; height: 40px; }
.prow .l { display: flex; align-items: center; min-width: 0; }
.prow .n { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-left: 4px; }
.prow .n.b { font-weight: 650; }
.ctl { display: flex; gap: 16px; color: #d5d3ce; font-size: 15px; padding-right: 4px; }
.orow { display: flex; align-items: center; height: 36px; }
.pin { width: 26px; font-size: 15px; }
`

function tab(p: DemoProject, i: number, opts: { popover?: boolean } = {}): string {
  const cls = i === ACTIVE ? 'tab active' : opts.popover ? 'tab hover' : 'tab'
  const popover = opts.popover
    ? `<div class="popover"><div class="title">Recent sessions · ${escape(p.name)}</div>${p.recent
        .map(
          (s, j) =>
            `<div class="row${j === 0 ? ' hl' : ''}">${img(dotSvg(s.state), 12, 26)}<span class="t">${escape(s.title)}</span></div>`,
        )
        .join('')}</div>`
    : ''
  return `<div class="${cls}">${img(digitSvg(i + 1), DIGIT_WIDTH, TAB_HEIGHT)}${img(
    tabIconSvg(p.icon),
    TAB_HEIGHT,
    TAB_HEIGHT,
  )}<span class="name">${escape(p.name)}</span>${img(
    countPillSvg(p.sessions, p.state),
    countPillWidth(p.sessions),
    TAB_HEIGHT,
  )}${popover}</div>`
}

function bandScene(opts: { hover: boolean }): string {
  const reply = opts.hover
    ? ''
    : `<p class="reply">Done: the checkout now offers Apple Pay when the browser supports it, and falls back to the card form otherwise. Tests pass; I added <code>checkout.applepay.test.ts</code> for both paths.</p>`
  const top = opts.hover ? '<div style="height:170px"></div>' : ''
  return `<div class="frame">${top}${reply}<div class="band"><div class="tabs">${PROJECTS.map((p, i) =>
    tab(p, i, { popover: opts.hover && i === HOVERED }),
  ).join('')}</div><div class="more">⋯</div></div><div class="prompt">Reply to Claude…</div></div>`
}

function paneScene(): string {
  const pinned = PROJECTS.map(
    (p, i) =>
      `<div class="prow"><div class="l">${img(tabIconSvg(p.icon), TAB_HEIGHT, TAB_HEIGHT)}${img(
        countPillSvg(p.sessions, p.state),
        countPillWidth(p.sessions),
        TAB_HEIGHT,
      )}<span class="n${i === ACTIVE ? ' b' : ''}">${escape(p.name)}</span></div><div class="ctl"><span>↑</span><span>↓</span><span>✎</span><span>✕</span></div></div>`,
  ).join('')
  const others = OTHERS.map(
    p =>
      `<div class="orow"><span class="pin">📌</span>${img(countPillSvg(p.sessions, p.state), countPillWidth(p.sessions), TAB_HEIGHT)}<span class="n">${escape(p.name)}</span></div>`,
  ).join('')
  return `<div class="pane"><div class="head"><span>Project tabs</span><span class="x">✕</span></div>
<div class="section"><span>Keyboard shortcuts</span><div class="btns"><span class="btn">Off</span><span class="btn primary">⌃1–9</span><span class="btn">⌘1–9</span></div></div>
<div class="section"><span>Pinned</span><span class="btn">Refresh icons</span></div>${pinned}
<div class="section"><span>Other projects</span></div>${others}</div>`
}

const page = (body: string) => `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`

/** The plugin's listing icon: a band of three project tabs, the middle one waiting for you. */
function iconPage(): string {
  const tabCss = `
html, body { margin: 0; width: 512px; height: 512px; background: #1d1c1b; }
.icon { width: 512px; height: 512px; display: flex; align-items: center; justify-content: center;
  background: radial-gradient(120% 120% at 30% 15%, #34322e 0%, #1d1c1b 60%, #141413 100%); }
.band { display: flex; flex-direction: column; gap: 22px; padding: 30px; width: 392px; border-radius: 44px; background: #121211;
  box-shadow: inset 0 0 0 2px #2b2a27; }
.t { display: flex; align-items: center; gap: 22px; height: 84px; padding: 0 22px; border-radius: 22px; }
.t.active { background: #2b2a27; }
.sq { width: 52px; height: 52px; border-radius: 15px; flex: none; }
.bar { height: 16px; border-radius: 8px; background: #8f8e89; flex: 1; }
.t.active .bar { background: #ecebe7; }
.pill { width: 44px; height: 40px; border-radius: 12px; box-shadow: inset 0 0 0 3px #4a4945; display: flex; align-items: center; justify-content: center; flex: none; }
.pill i { width: 16px; height: 16px; border-radius: 50%; background: #c98500; }
`
  const tab = (color: string, opts: { active?: boolean; waiting?: boolean; short?: boolean }) =>
    `<div class="t${opts.active ? ' active' : ''}"><span class="sq" style="background:${color}"></span><span class="bar"${
      opts.short ? ' style="flex:0 0 120px"' : ''
    }></span>${opts.waiting ? '<span class="pill"><i></i></span>' : ''}</div>`
  return `<!doctype html><html><head><meta charset="utf-8"><style>${tabCss}</style></head><body><div class="icon"><div class="band">${tab(
    '#0f766e',
    { active: true },
  )}${tab('#c76b8e', { waiting: true })}${tab('#7d7fd1', { short: true })}</div></div></body></html>`
}

const SCENES = [
  { name: 'tabs', html: page(bandScene({ hover: false })), width: 1060, height: 252, out: 'docs/screenshots/tabs.png' },
  { name: 'hover', html: page(bandScene({ hover: true })), width: 1060, height: 360, out: 'docs/screenshots/hover.png' },
  { name: 'pane', html: page(paneScene()), width: 470, height: 562, out: 'docs/screenshots/pane.png' },
  { name: 'icon', html: iconPage(), width: 512, height: 512, out: '.claude-plugin/icon.png' },
]

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const outDir = join(root, 'docs/screenshots')
const htmlDir = join(root, 'docs/demo/out')
mkdirSync(outDir, { recursive: true })
mkdirSync(htmlDir, { recursive: true })

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
for (const scene of SCENES) {
  const html = join(htmlDir, `${scene.name}.html`)
  writeFileSync(html, scene.html)
  execFileSync(CHROME, [
    '--headless=new',
    '--hide-scrollbars',
    '--force-dark-mode',
    '--force-device-scale-factor=2',
    `--window-size=${scene.width},${scene.height}`,
    `--screenshot=${join(root, scene.out)}`,
    `file://${html}`,
  ], { stdio: 'ignore' })
  console.log(scene.out)
}
