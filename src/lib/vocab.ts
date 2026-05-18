export type WordBook = 'study' | 'mistake' | 'killed'
export type MorphemeKind = 'prefix' | 'root' | 'suffix'
export type MorphemeKindFilter = MorphemeKind | 'all'

export type WordEntry = {
  word: string
  phonetic: string
  translation: string
  pos: string
  tags: string[]
  rootIds: string[]
}

export type RootEntry = {
  id: string
  title: string
  meaning: string
  origin?: string
  note: string
  kind: MorphemeKind
}

export type DailyPlanState = {
  date: string
  newItemIds: string[]
  reviewItemIds: string[]
}

export type ProgressState = {
  mistakeWords: string[]
  killedWords: string[]
  learnedMorphemeIds: string[]
  wordNotes: Record<string, string>
  dailyPlan?: DailyPlanState
  lastStudiedRootId?: string
}

export type CoverageStats = {
  total: number
  rooted: number
  supplemental: number
}

export type RootDeck = RootEntry & {
  words: WordEntry[]
}

export type RootDeckBuild = {
  rootDecks: RootDeck[]
  supplementalWords: WordEntry[]
}

export type RootGroups = Record<MorphemeKind, RootEntry[]>

export type DailyPlan = {
  newItems: RootDeck[]
  reviewItems: RootDeck[]
}

const emptyProgress: ProgressState = {
  mistakeWords: [],
  killedWords: [],
  learnedMorphemeIds: [],
  wordNotes: {},
  dailyPlan: undefined,
  lastStudiedRootId: undefined,
}

const rootLabels: Record<string, Pick<RootEntry, 'meaning' | 'origin' | 'note' | 'kind'>> = {
  port: {
    meaning: '携带，运送',
    origin: 'Latin',
    note: '把 port 想成“搬运通道”：transport 是运送，portable 是能带走。',
    kind: 'root',
  },
}

export function normalizeProgress(progress: Partial<ProgressState> = {}): ProgressState {
  return {
    mistakeWords: uniqueWords(progress.mistakeWords ?? emptyProgress.mistakeWords),
    killedWords: uniqueWords(progress.killedWords ?? emptyProgress.killedWords),
    learnedMorphemeIds: uniqueWords(progress.learnedMorphemeIds ?? emptyProgress.learnedMorphemeIds),
    wordNotes: normalizeWordNotes(progress.wordNotes),
    dailyPlan: normalizeDailyPlan(progress.dailyPlan),
    lastStudiedRootId: progress.lastStudiedRootId,
  }
}

export function setWordBook(
  progress: ProgressState,
  word: string,
  book: WordBook,
): ProgressState {
  const normalized = normalizeProgress(progress)
  const next: ProgressState = {
    ...normalized,
    mistakeWords: normalized.mistakeWords.filter((entry) => entry !== word),
    killedWords: normalized.killedWords.filter((entry) => entry !== word),
  }

  if (book === 'mistake') {
    next.mistakeWords = uniqueWords([word, ...next.mistakeWords])
  }

  if (book === 'killed') {
    next.killedWords = uniqueWords([word, ...next.killedWords])
  }

  return next
}

export function setMorphemeLearned(
  progress: ProgressState,
  rootId: string,
  learned: boolean,
): ProgressState {
  const normalized = normalizeProgress(progress)
  const learnedMorphemeIds = normalized.learnedMorphemeIds.filter((entry) => entry !== rootId)

  return {
    ...normalized,
    learnedMorphemeIds: learned ? uniqueWords([rootId, ...learnedMorphemeIds]) : learnedMorphemeIds,
  }
}

export function isMorphemeLearned(progress: ProgressState, rootId: string): boolean {
  return normalizeProgress(progress).learnedMorphemeIds.includes(rootId)
}

export function setWordNote(progress: ProgressState, word: string, note: string): ProgressState {
  const normalized = normalizeProgress(progress)
  const wordNotes = { ...normalized.wordNotes }
  const trimmed = note.trim()

  if (trimmed) {
    wordNotes[word] = note
  } else {
    delete wordNotes[word]
  }

  return {
    ...normalized,
    wordNotes,
  }
}

export function getWordNote(progress: ProgressState, word: string): string {
  return normalizeProgress(progress).wordNotes[word] ?? ''
}

export function getWordBook(progress: ProgressState, word: string): WordBook {
  if (progress.killedWords.includes(word)) {
    return 'killed'
  }

  if (progress.mistakeWords.includes(word)) {
    return 'mistake'
  }

  return 'study'
}

export function getStudyQueue(words: WordEntry[], progress: ProgressState): WordEntry[] {
  const normalized = normalizeProgress(progress)
  const killed = new Set(normalized.killedWords)
  const mistakes = new Set(normalized.mistakeWords)

  return [...words]
    .filter((entry) => !killed.has(entry.word))
    .sort((left, right) => {
      const leftMistake = mistakes.has(left.word)
      const rightMistake = mistakes.has(right.word)

      if (leftMistake === rightMistake) {
        return 0
      }

      return leftMistake ? -1 : 1
    })
}

export function getCoverageStats(words: WordEntry[]): CoverageStats {
  const total = words.length
  const rooted = words.filter((entry) => entry.rootIds.length > 0).length

  return {
    total,
    rooted,
    supplemental: total - rooted,
  }
}

export function buildRootDeck(
  words: WordEntry[],
  roots: RootEntry[] = [],
  kindFilter: MorphemeKindFilter = 'all',
): RootDeckBuild {
  const rootMap = new Map<string, RootDeck>()
  const supplementalWords: WordEntry[] = []

  for (const word of words) {
    const matchingRoots = word.rootIds
      .map((rootId) => roots.find((entry) => entry.id === rootId) ?? createFallbackRoot(rootId))
      .filter((root) => kindFilter === 'all' || root.kind === kindFilter)

    if (matchingRoots.length === 0) {
      if (word.rootIds.length === 0 || kindFilter === 'all') {
        supplementalWords.push(word)
      }
      continue
    }

    for (const root of matchingRoots) {
      const existing = rootMap.get(root.id)

      if (existing) {
        existing.words.push(word)
      } else {
        rootMap.set(root.id, { ...root, words: [word] })
      }
    }
  }

  return {
    rootDecks: [...rootMap.values()].sort((left, right) => right.words.length - left.words.length),
    supplementalWords,
  }
}

export function getRootGroups(word: WordEntry, roots: RootEntry[]): RootGroups {
  const rootsById = new Map(roots.map((root) => [root.id, root]))
  const groups: RootGroups = {
    prefix: [],
    root: [],
    suffix: [],
  }

  for (const rootId of word.rootIds) {
    const root = rootsById.get(rootId) ?? createFallbackRoot(rootId)
    groups[root.kind].push(root)
  }

  return groups
}

export function getDailyPlan(
  roots: RootEntry[],
  words: WordEntry[],
  progress: ProgressState,
): DailyPlan {
  const normalized = normalizeProgress(progress)
  const deck = buildRootDeck(words, roots).rootDecks
  const deckById = new Map(deck.map((entry) => [entry.id, entry]))

  if (normalized.dailyPlan) {
    return {
      newItems: normalized.dailyPlan.newItemIds
        .map((id) => deckById.get(id))
        .filter((entry): entry is RootDeck => Boolean(entry)),
      reviewItems: normalized.dailyPlan.reviewItemIds
        .map((id) => deckById.get(id))
        .filter((entry): entry is RootDeck => Boolean(entry)),
    }
  }

  const learned = new Set(normalized.learnedMorphemeIds)

  return {
    newItems: sampleItems(deck.filter((entry) => !learned.has(entry.id)), 5),
    reviewItems: sampleItems(deck.filter((entry) => learned.has(entry.id)), 5),
  }
}

export function ensureDailyPlanProgress(
  progress: ProgressState,
  roots: RootEntry[],
  words: WordEntry[],
  date = getTodayKey(),
): ProgressState {
  const normalized = normalizeProgress(progress)

  if (normalized.dailyPlan?.date === date) {
    return normalized
  }

  const learned = new Set(normalized.learnedMorphemeIds)
  const deck = buildRootDeck(words, roots).rootDecks

  return {
    ...normalized,
    dailyPlan: {
      date,
      newItemIds: sampleItems(deck.filter((entry) => !learned.has(entry.id)), 5).map((entry) => entry.id),
      reviewItemIds: sampleItems(deck.filter((entry) => learned.has(entry.id)), 5).map((entry) => entry.id),
    },
  }
}

export function getWordMemoryNote(word: WordEntry, roots: RootEntry[]): string {
  const groups = getRootGroups(word, roots)
  const morphemes = (['prefix', 'root', 'suffix'] as const).flatMap((kind) => groups[kind])

  if (morphemes.length === 0) {
    return ''
  }

  const comRoot = morphemes.find((entry) => entry.id === 'com-')
  const monRoot = morphemes.find((entry) => entry.id === 'mon')

  if (word.word.toLowerCase() === 'common' && comRoot && monRoot) {
    return `构词批注：common 可以拆成 com-（${comRoot.meaning}）+ mon（${monRoot.meaning}）。所有人一起遵守的提醒和约定，就形成 common：共同的、共识的、通常的。`
  }

  const clues = morphemes.map((entry) => `${entry.title}（${entry.meaning}）`).join(' + ')
  return `构词批注：${word.word} 可以看作 ${clues}。把这些线索连起来，帮助记住：${word.translation}。`
}

function createFallbackRoot(rootId: string): RootEntry {
  const label = rootLabels[rootId]
  const kind = label?.kind ?? inferKindFromId(rootId)

  return {
    id: rootId,
    title: rootId,
    meaning: label?.meaning ?? '构词线索',
    origin: label?.origin,
    note: label?.note ?? `把 ${rootId} 作为这一组单词的共同记忆线索。`,
    kind,
  }
}

function inferKindFromId(rootId: string): MorphemeKind {
  if (rootId.startsWith('-')) {
    return 'suffix'
  }

  if (rootId.endsWith('-')) {
    return 'prefix'
  }

  return 'root'
}

function uniqueWords(words: string[]): string[] {
  return [...new Set(words.filter(Boolean))]
}

function normalizeWordNotes(notes: ProgressState['wordNotes'] | undefined): Record<string, string> {
  if (!notes || typeof notes !== 'object') {
    return {}
  }

  return Object.fromEntries(
    Object.entries(notes).filter(([, note]) => typeof note === 'string' && note.trim()),
  )
}

function normalizeDailyPlan(plan: ProgressState['dailyPlan'] | undefined): DailyPlanState | undefined {
  if (!plan || typeof plan.date !== 'string') {
    return undefined
  }

  return {
    date: plan.date,
    newItemIds: uniqueWords(plan.newItemIds ?? []),
    reviewItemIds: uniqueWords(plan.reviewItemIds ?? []),
  }
}

function getTodayKey(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function sampleItems<T>(items: T[], limit: number): T[] {
  return [...items]
    .sort(() => Math.random() - 0.5)
    .slice(0, limit)
}
