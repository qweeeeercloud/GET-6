export type WordBook = 'study' | 'mistake' | 'killed'

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
}

export type ProgressState = {
  mistakeWords: string[]
  killedWords: string[]
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

const emptyProgress: ProgressState = {
  mistakeWords: [],
  killedWords: [],
}

const rootLabels: Record<string, Pick<RootEntry, 'meaning' | 'origin' | 'note'>> = {
  port: {
    meaning: '携带，运送',
    origin: 'Latin',
    note: '把 port 想成“搬运通道”：transport 是运送，portable 是能带走。',
  },
}

export function normalizeProgress(progress: Partial<ProgressState> = {}): ProgressState {
  return {
    mistakeWords: uniqueWords(progress.mistakeWords ?? emptyProgress.mistakeWords),
    killedWords: uniqueWords(progress.killedWords ?? emptyProgress.killedWords),
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

export function buildRootDeck(words: WordEntry[], roots: RootEntry[] = []): RootDeckBuild {
  const rootMap = new Map<string, RootDeck>()
  const supplementalWords: WordEntry[] = []

  for (const word of words) {
    if (word.rootIds.length === 0) {
      supplementalWords.push(word)
      continue
    }

    for (const rootId of word.rootIds) {
      const root = roots.find((entry) => entry.id === rootId) ?? createFallbackRoot(rootId)
      const existing = rootMap.get(rootId)

      if (existing) {
        existing.words.push(word)
      } else {
        rootMap.set(rootId, { ...root, words: [word] })
      }
    }
  }

  return {
    rootDecks: [...rootMap.values()].sort((left, right) => right.words.length - left.words.length),
    supplementalWords,
  }
}

function createFallbackRoot(rootId: string): RootEntry {
  const label = rootLabels[rootId]

  return {
    id: rootId,
    title: rootId,
    meaning: label?.meaning ?? '词根/词缀线索',
    origin: label?.origin,
    note: label?.note ?? `把 ${rootId} 作为这一组单词的共同记忆线索。`,
  }
}

function uniqueWords(words: string[]): string[] {
  return [...new Set(words.filter(Boolean))]
}
