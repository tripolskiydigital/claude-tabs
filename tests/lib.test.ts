import { expect, test } from 'claude-code/testing'

import { langOf, t as tr } from '../hooks/i18n'
import { iconRank, tabIconSvg } from '../hooks/lib'

test('icons rank svg over png over ico, shallow over deep, web roots first', async () => {
  const ranked = [
    'backend/storefront/public/favicon.ico',
    'backend/storefront/public/favicon-96x96.png',
    'backend/storefront/public/favicon.svg',
    'backend/storefront/public/apple-touch-icon.png',
    'docs/img/favicon.svg',
    'public/favicon.png',
  ]
    .map(path => ({ path, rank: iconRank(path)! }))
    .sort((a, b) => a.rank - b.rank)
    .map(r => r.path)

  expect(ranked).toEqual([
    'public/favicon.png',
    'docs/img/favicon.svg',
    'backend/storefront/public/favicon.svg',
    'backend/storefront/public/favicon-96x96.png',
    'backend/storefront/public/apple-touch-icon.png',
    'backend/storefront/public/favicon.ico',
  ])
  expect(iconRank('src/logo.svg')).toBeUndefined()
  expect(iconRank('legacy/theme/images/favicon')).toBeUndefined()
})

test('the letter icon is the same rounded 20px square whatever the letter', async () => {
  for (const name of ['i', 'Ш', 'mamont']) {
    const svg = tabIconSvg({ kind: 'letter', name })
    expect(svg).toContain('width="28" height="28"')
    expect(svg).toContain('x="4" y="4" width="20" height="20" rx="6"')
  }
})

test('desktop locales pick the interface language, English otherwise', async () => {
  expect(langOf('ru')).toBe('ru')
  expect(langOf('de-DE')).toBe('de')
  expect(langOf('es-419')).toBe('es')
  expect(langOf('uk')).toBe('uk')
  expect(langOf('ja-JP')).toBe('en')
  expect(langOf(undefined)).toBe('en')
  expect(tr('fr', 'iconsAll', { found: 2, total: 3 })).toBe('Icônes actualisées : 2 sur 3')
})
