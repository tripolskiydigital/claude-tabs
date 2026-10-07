import type { Lang, SessionState } from '../types'

type Strings = {
  title: string
  cmdDesc: string
  cmdOpened: string
  noPinned: string
  pinThis: string
  recentSessions: string
  openFailed: string
  iconsAll: string
  iconsSome: string
  pinned: string
  emptyPinned: string
  others: string
  refreshIcons: string
  chooseFile: string
  autoIcon: string
  otherEmoji: string
  save: string
  choosePrompt: string
  fileTooBig: string
  iconFailed: string
  shortcuts: string
  shortcutsOff: string
  shortcutsBuilding: string
  shortcutsOn: string
  shortcutsDisabled: string
  shortcutsFailed: string
  states: Record<SessionState, string>
}

const STRINGS: Record<Lang, Strings> = {
  en: {
    title: 'Project tabs',
    cmdDesc: 'Project tabs: pin, unpin, order, icons',
    cmdOpened: 'Opened the project tabs pane.',
    noPinned: 'No pinned projects',
    pinThis: '📌 Pin this project',
    recentSessions: 'Recent sessions · {name}',
    openFailed: "Couldn't open: {error}",
    iconsAll: 'Icons refreshed: {found} of {total}',
    iconsSome:
      'Icons refreshed: found {found} of {total}, the rest show a letter. Pick your own with ✎ or put it in the project as .claude/icon.svg or .claude/icon.png.',
    pinned: 'Pinned',
    emptyPinned: 'Nothing yet: pin a project from the list below.',
    others: 'Other projects',
    refreshIcons: 'Refresh icons',
    chooseFile: 'Choose file…',
    autoIcon: 'Automatic',
    otherEmoji: 'or type an emoji',
    save: 'save',
    choosePrompt: 'Icon for “{name}”',
    fileTooBig: 'That SVG is over 90 KB: pick a smaller one.',
    iconFailed: "Couldn't use that image: {error}",
    shortcuts: 'Keyboard shortcuts',
    shortcutsOff: 'Off',
    shortcutsBuilding: 'Setting up keyboard shortcuts…',
    shortcutsOn: '{keys} switch tabs while Claude is in front',
    shortcutsDisabled: 'Keyboard shortcuts are off',
    shortcutsFailed: "Couldn't set up keyboard shortcuts: {error}",
    states: { waiting: 'waiting for you', unread: 'done, unread', running: 'running', idle: 'quiet' },
  },
  ru: {
    title: 'Вкладки проектов',
    cmdDesc: 'Вкладки проектов: закрепить, открепить, порядок, иконки',
    cmdOpened: 'Открыта панель вкладок проектов.',
    noPinned: 'Нет закреплённых проектов',
    pinThis: '📌 Закрепить этот проект',
    recentSessions: 'Последние сессии · {name}',
    openFailed: 'Не удалось открыть: {error}',
    iconsAll: 'Иконки обновлены: {found} из {total}',
    iconsSome:
      'Иконки обновлены: найдено {found} из {total}, остальным — буква. Свою иконку можно выбрать через ✎ или положить в проект как .claude/icon.svg или .claude/icon.png.',
    pinned: 'Закреплённые',
    emptyPinned: 'Пока пусто: закрепите проект из списка ниже.',
    others: 'Остальные проекты',
    refreshIcons: 'Обновить иконки',
    chooseFile: 'Выбрать файл…',
    autoIcon: 'Авто',
    otherEmoji: 'или введите эмодзи',
    save: 'сохранить',
    choosePrompt: 'Иконка для «{name}»',
    fileTooBig: 'SVG больше 90 КБ — выберите файл поменьше.',
    iconFailed: 'Не удалось использовать картинку: {error}',
    shortcuts: 'Горячие клавиши',
    shortcutsOff: 'Выкл',
    shortcutsBuilding: 'Настраиваю горячие клавиши…',
    shortcutsOn: '{keys} переключают вкладки, пока Claude на переднем плане',
    shortcutsDisabled: 'Горячие клавиши выключены',
    shortcutsFailed: 'Не удалось настроить горячие клавиши: {error}',
    states: { waiting: 'ждёт ответа', unread: 'готово, не прочитано', running: 'работает', idle: 'спокойна' },
  },
  uk: {
    title: 'Вкладки проєктів',
    cmdDesc: 'Вкладки проєктів: закріпити, відкріпити, порядок, іконки',
    cmdOpened: 'Відкрито панель вкладок проєктів.',
    noPinned: 'Немає закріплених проєктів',
    pinThis: '📌 Закріпити цей проєкт',
    recentSessions: 'Останні сесії · {name}',
    openFailed: 'Не вдалося відкрити: {error}',
    iconsAll: 'Іконки оновлено: {found} з {total}',
    iconsSome:
      'Іконки оновлено: знайдено {found} з {total}, решті — літера. Свою іконку можна вибрати через ✎ або покласти в проєкт як .claude/icon.svg чи .claude/icon.png.',
    pinned: 'Закріплені',
    emptyPinned: 'Поки порожньо: закріпіть проєкт зі списку нижче.',
    others: 'Інші проєкти',
    refreshIcons: 'Оновити іконки',
    chooseFile: 'Вибрати файл…',
    autoIcon: 'Авто',
    otherEmoji: 'або введіть емодзі',
    save: 'зберегти',
    choosePrompt: 'Іконка для «{name}»',
    fileTooBig: 'SVG більший за 90 КБ — виберіть менший файл.',
    iconFailed: 'Не вдалося використати зображення: {error}',
    shortcuts: 'Гарячі клавіші',
    shortcutsOff: 'Вимк',
    shortcutsBuilding: 'Налаштовую гарячі клавіші…',
    shortcutsOn: '{keys} перемикають вкладки, поки Claude на передньому плані',
    shortcutsDisabled: 'Гарячі клавіші вимкнено',
    shortcutsFailed: 'Не вдалося налаштувати гарячі клавіші: {error}',
    states: {
      waiting: 'чекає на відповідь',
      unread: 'готово, не прочитано',
      running: 'працює',
      idle: 'спокійна',
    },
  },
  de: {
    title: 'Projekt-Tabs',
    cmdDesc: 'Projekt-Tabs: anheften, lösen, sortieren, Symbole',
    cmdOpened: 'Bereich „Projekt-Tabs“ geöffnet.',
    noPinned: 'Keine angehefteten Projekte',
    pinThis: '📌 Dieses Projekt anheften',
    recentSessions: 'Letzte Sitzungen · {name}',
    openFailed: 'Öffnen fehlgeschlagen: {error}',
    iconsAll: 'Symbole aktualisiert: {found} von {total}',
    iconsSome:
      'Symbole aktualisiert: {found} von {total} gefunden, die übrigen zeigen einen Buchstaben. Ein eigenes Symbol wählst du mit ✎ oder legst es als .claude/icon.svg bzw. .claude/icon.png ins Projekt.',
    pinned: 'Angeheftet',
    emptyPinned: 'Noch leer: Hefte ein Projekt aus der Liste unten an.',
    others: 'Weitere Projekte',
    refreshIcons: 'Symbole aktualisieren',
    chooseFile: 'Datei wählen…',
    autoIcon: 'Automatisch',
    otherEmoji: 'oder Emoji eingeben',
    save: 'speichern',
    choosePrompt: 'Symbol für „{name}“',
    fileTooBig: 'Die SVG-Datei ist größer als 90 KB – bitte eine kleinere wählen.',
    iconFailed: 'Bild konnte nicht verwendet werden: {error}',
    shortcuts: 'Tastenkürzel',
    shortcutsOff: 'Aus',
    shortcutsBuilding: 'Tastenkürzel werden eingerichtet…',
    shortcutsOn: '{keys} wechseln die Tabs, solange Claude im Vordergrund ist',
    shortcutsDisabled: 'Tastenkürzel sind aus',
    shortcutsFailed: 'Tastenkürzel konnten nicht eingerichtet werden: {error}',
    states: { waiting: 'wartet auf dich', unread: 'fertig, ungelesen', running: 'läuft', idle: 'ruhig' },
  },
  fr: {
    title: 'Onglets de projets',
    cmdDesc: 'Onglets de projets : épingler, désépingler, ordre, icônes',
    cmdOpened: 'Panneau des onglets de projets ouvert.',
    noPinned: 'Aucun projet épinglé',
    pinThis: '📌 Épingler ce projet',
    recentSessions: 'Sessions récentes · {name}',
    openFailed: 'Impossible d’ouvrir : {error}',
    iconsAll: 'Icônes actualisées : {found} sur {total}',
    iconsSome:
      'Icônes actualisées : {found} sur {total} trouvées, les autres affichent une lettre. Choisissez la vôtre avec ✎ ou placez-la dans le projet sous .claude/icon.svg ou .claude/icon.png.',
    pinned: 'Épinglés',
    emptyPinned: 'Rien pour l’instant : épinglez un projet de la liste ci-dessous.',
    others: 'Autres projets',
    refreshIcons: 'Actualiser les icônes',
    chooseFile: 'Choisir un fichier…',
    autoIcon: 'Automatique',
    otherEmoji: 'ou saisissez un emoji',
    save: 'enregistrer',
    choosePrompt: 'Icône pour « {name} »',
    fileTooBig: 'Ce SVG dépasse 90 Ko : choisissez-en un plus petit.',
    iconFailed: 'Impossible d’utiliser cette image : {error}',
    shortcuts: 'Raccourcis clavier',
    shortcutsOff: 'Désactivés',
    shortcutsBuilding: 'Configuration des raccourcis clavier…',
    shortcutsOn: '{keys} changent d’onglet tant que Claude est au premier plan',
    shortcutsDisabled: 'Raccourcis clavier désactivés',
    shortcutsFailed: 'Impossible de configurer les raccourcis clavier : {error}',
    states: { waiting: 'vous attend', unread: 'terminée, non lue', running: 'en cours', idle: 'au repos' },
  },
  it: {
    title: 'Schede progetto',
    cmdDesc: 'Schede progetto: fissa, sblocca, ordina, icone',
    cmdOpened: 'Pannello delle schede progetto aperto.',
    noPinned: 'Nessun progetto fissato',
    pinThis: '📌 Fissa questo progetto',
    recentSessions: 'Sessioni recenti · {name}',
    openFailed: 'Impossibile aprire: {error}',
    iconsAll: 'Icone aggiornate: {found} di {total}',
    iconsSome:
      'Icone aggiornate: trovate {found} di {total}, le altre mostrano una lettera. Scegli la tua con ✎ o mettila nel progetto come .claude/icon.svg o .claude/icon.png.',
    pinned: 'Fissati',
    emptyPinned: 'Ancora vuoto: fissa un progetto dall’elenco qui sotto.',
    others: 'Altri progetti',
    refreshIcons: 'Aggiorna icone',
    chooseFile: 'Scegli file…',
    autoIcon: 'Automatica',
    otherEmoji: 'o digita un’emoji',
    save: 'salva',
    choosePrompt: 'Icona per «{name}»',
    fileTooBig: 'L’SVG supera i 90 KB: scegline uno più piccolo.',
    iconFailed: 'Impossibile usare l’immagine: {error}',
    shortcuts: 'Scorciatoie da tastiera',
    shortcutsOff: 'Disattive',
    shortcutsBuilding: 'Configurazione delle scorciatoie…',
    shortcutsOn: '{keys} cambiano scheda mentre Claude è in primo piano',
    shortcutsDisabled: 'Scorciatoie da tastiera disattivate',
    shortcutsFailed: 'Impossibile configurare le scorciatoie: {error}',
    states: { waiting: 'ti aspetta', unread: 'finita, non letta', running: 'in corso', idle: 'inattiva' },
  },
  es: {
    title: 'Pestañas de proyectos',
    cmdDesc: 'Pestañas de proyectos: fijar, desfijar, ordenar, iconos',
    cmdOpened: 'Panel de pestañas de proyectos abierto.',
    noPinned: 'No hay proyectos fijados',
    pinThis: '📌 Fijar este proyecto',
    recentSessions: 'Sesiones recientes · {name}',
    openFailed: 'No se pudo abrir: {error}',
    iconsAll: 'Iconos actualizados: {found} de {total}',
    iconsSome:
      'Iconos actualizados: encontrados {found} de {total}; el resto muestra una letra. Elige el tuyo con ✎ o ponlo en el proyecto como .claude/icon.svg o .claude/icon.png.',
    pinned: 'Fijados',
    emptyPinned: 'Aún vacío: fija un proyecto de la lista de abajo.',
    others: 'Otros proyectos',
    refreshIcons: 'Actualizar iconos',
    chooseFile: 'Elegir archivo…',
    autoIcon: 'Automático',
    otherEmoji: 'o escribe un emoji',
    save: 'guardar',
    choosePrompt: 'Icono para «{name}»',
    fileTooBig: 'Ese SVG supera los 90 KB: elige uno más pequeño.',
    iconFailed: 'No se pudo usar la imagen: {error}',
    shortcuts: 'Atajos de teclado',
    shortcutsOff: 'Desactivados',
    shortcutsBuilding: 'Configurando los atajos de teclado…',
    shortcutsOn: '{keys} cambian de pestaña mientras Claude está al frente',
    shortcutsDisabled: 'Atajos de teclado desactivados',
    shortcutsFailed: 'No se pudieron configurar los atajos: {error}',
    states: { waiting: 'te espera', unread: 'lista, sin leer', running: 'en curso', idle: 'en reposo' },
  },
}

export const LANGS = Object.keys(STRINGS) as Lang[]

/** The interface language for a desktop locale (`ru`, `de-DE`, `es-419`); English otherwise. */
export function langOf(locale: string | undefined): Lang {
  const prefix = locale?.toLowerCase().split(/[-_]/)[0]
  return LANGS.find(lang => lang === prefix) ?? 'en'
}

type Key = Exclude<keyof Strings, 'states'>

/** A string of the interface in `lang`, its `{name}` slots filled. */
export function t(lang: Lang, key: Key, vars: Record<string, string | number> = {}): string {
  return STRINGS[lang][key].replace(/\{(\w+)\}/g, (slot, name: string) =>
    name in vars ? String(vars[name]) : slot,
  )
}

export function stateLabel(lang: Lang, state: SessionState): string {
  return STRINGS[lang].states[state]
}
