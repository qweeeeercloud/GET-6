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
    return `构词批注：不是死记 common。com- 是“${comRoot.meaning}”，mon 是“${monRoot.meaning}”。想象一群人被同一个提醒反复提示，慢慢形成大家都认可、大家都知道的东西，所以 common 就是“共同的、共识的、通常的”。`
  }

  const morphemeIntro = morphemes
    .map((entry) => `${entry.title} 是“${entry.meaning}”`)
    .join('，')
  const scene = buildMemoryScene(word, morphemes)
  const meaning = getReadableTranslation(word.translation)

  return `构词批注：先别死记 ${word.word}。${morphemeIntro}。${scene}这样看到 ${word.word} 时，先想这个画面，再落到“${meaning}”。`
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

function buildMemoryScene(word: WordEntry, morphemes: RootEntry[]): string {
  const ids = new Set(morphemes.map((entry) => entry.id))

  if (word.word.toLowerCase() === 'transport' && ids.has('trans-') && ids.has('port')) {
    return '先把它想成一个动作：带着东西穿过一段路，从一个地方送到另一个地方。'
  }

  if (word.word.toLowerCase() === 'portable' && ids.has('port') && ids.has('-able')) {
    return '先把它想成一个随身动作：东西能被带着走、搬着用。'
  }

  const prefix = morphemes.find((entry) => entry.kind === 'prefix')
  const root = morphemes.find((entry) => entry.kind === 'root')
  const suffix = morphemes.find((entry) => entry.kind === 'suffix')

  if (prefix && root && suffix) {
    return `先抓住顺序：${prefix.title} 给方向，${root.title} 给核心动作，${suffix.title} 说明词性或结果。`
  }

  if (prefix && root) {
    return `先抓住画面：${prefix.title} 像是在前面加了一个方向，${root.title} 是这个词真正要做的动作。`
  }

  if (root && suffix) {
    return `先抓住画面：${root.title} 是核心动作，${suffix.title} 像是在后面补一句“能这样”或“这种结果”。`
  }

  return `先抓住它最重要的构词块：${morphemes[0].title}，把这个意思当成记忆入口。`
}

function getReadableTranslation(translation: string): string {
  return translation
    .replace(/\b[a-z]+\./gi, '')
    .replace(/[;；]/g, '、')
    .replace(/\s+/g, ' ')
    .trim()
}

function sampleItems<T>(items: T[], limit: number): T[] {
  return [...items]
    .sort(() => Math.random() - 0.5)
    .slice(0, limit)
}
