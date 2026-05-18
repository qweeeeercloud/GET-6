import { describe, expect, it } from 'vitest'
import {
  buildRootDeck,
  ensureDailyPlanProgress,
  getDailyPlan,
  getCoverageStats,
  getRootGroups,
  getStudyQueue,
  getWordMemoryNote,
  getWordNote,
  isMorphemeLearned,
  normalizeProgress,
  setMorphemeLearned,
  setWordNote,
  setWordBook,
  type ProgressState,
  type RootEntry,
  type WordEntry,
} from './vocab'

const roots: RootEntry[] = [
  {
    id: 'trans-',
    title: 'trans-',
    meaning: '穿过，越过',
    note: 'trans- 表示穿过、越过。',
    kind: 'prefix',
  },
  {
    id: 'port',
    title: 'port',
    meaning: '携带，运送',
    note: 'port 表示携带、运送。',
    kind: 'root',
  },
  {
    id: '-able',
    title: '-able',
    meaning: '能够，可以被',
    note: '-able 表示能够或可以被。',
    kind: 'suffix',
  },
]

const words: WordEntry[] = [
  {
    word: 'transport',
    phonetic: "træn'spɔ:t",
    translation: 'vt. 运输; 传送',
    pos: 'v',
    tags: ['cet6'],
    rootIds: ['trans-', 'port'],
  },
  {
    word: 'portable',
    phonetic: "'pɔ:təbl",
    translation: 'a. 可携带的',
    pos: 'a',
    tags: ['cet6'],
    rootIds: ['port', '-able'],
  },
  {
    word: 'random',
    phonetic: "'rændəm",
    translation: 'a. 随机的',
    pos: 'a',
    tags: ['cet6'],
    rootIds: [],
  },
  {
    word: 'common',
    phonetic: "'kɒmәn",
    translation: 'a. 通常的, 共同的, 通俗的, 公共的',
    pos: 'a',
    tags: ['cet6'],
    rootIds: ['com-', 'mon'],
  },
]

const commonRoots: RootEntry[] = [
  {
    id: 'com-',
    title: 'com-',
    meaning: '共同，一起',
    note: 'com- 表示共同、一起。',
    kind: 'prefix',
  },
  {
    id: 'mon',
    title: 'mon',
    meaning: '提醒，警告',
    note: 'mon 表示提醒、警告。',
    kind: 'root',
  },
]

describe('vocab progress', () => {
  it('moves a word between study, mistakes and killed books without duplication', () => {
    let progress: ProgressState = normalizeProgress()

    progress = setWordBook(progress, 'transport', 'mistake')
    expect(progress.mistakeWords).toEqual(['transport'])
    expect(progress.killedWords).toEqual([])

    progress = setWordBook(progress, 'transport', 'killed')
    expect(progress.mistakeWords).toEqual([])
    expect(progress.killedWords).toEqual(['transport'])

    progress = setWordBook(progress, 'transport', 'study')
    expect(progress.mistakeWords).toEqual([])
    expect(progress.killedWords).toEqual([])
    expect(progress.learnedMorphemeIds).toEqual([])
  })

  it('tracks learned morphemes without affecting word books', () => {
    let progress: ProgressState = normalizeProgress({
      mistakeWords: ['random'],
    })

    progress = setMorphemeLearned(progress, 'port', true)
    progress = setMorphemeLearned(progress, 'port', true)

    expect(isMorphemeLearned(progress, 'port')).toBe(true)
    expect(progress.learnedMorphemeIds).toEqual(['port'])
    expect(progress.mistakeWords).toEqual(['random'])

    progress = setMorphemeLearned(progress, 'port', false)

    expect(isMorphemeLearned(progress, 'port')).toBe(false)
    expect(progress.learnedMorphemeIds).toEqual([])
  })

  it('stores personal notes for mistake words', () => {
    let progress: ProgressState = normalizeProgress()

    progress = setWordNote(progress, 'transport', '总把 trans- 忘成 transfer，记住跨过去再搬运。')

    expect(getWordNote(progress, 'transport')).toBe('总把 trans- 忘成 transfer，记住跨过去再搬运。')
    expect(progress.wordNotes.transport).toBe('总把 trans- 忘成 transfer，记住跨过去再搬运。')

    progress = setWordNote(progress, 'transport', ' ')

    expect(getWordNote(progress, 'transport')).toBe('')
    expect(progress.wordNotes.transport).toBeUndefined()
  })

  it('excludes killed words from the default study queue while keeping mistakes visible first', () => {
    const progress = normalizeProgress({
      mistakeWords: ['random'],
      killedWords: ['transport'],
    })

    expect(getStudyQueue(words, progress).map((entry) => entry.word)).toEqual([
      'random',
      'portable',
      'common',
    ])
  })
})

describe('vocab data helpers', () => {
  it('counts imported CET-6 coverage and rooted words', () => {
    expect(getCoverageStats(words)).toEqual({
      total: 4,
      rooted: 3,
      supplemental: 1,
    })
  })

  it('builds root decks and leaves unrooted words for supplemental learning', () => {
    const deck = buildRootDeck(words, roots)

    expect(deck.rootDecks).toHaveLength(5)
    expect(deck.rootDecks.find((entry) => entry.id === 'port')).toMatchObject({
      id: 'port',
      title: 'port',
      kind: 'root',
      words: [words[0], words[1]],
    })
    expect(deck.supplementalWords).toEqual([words[2]])
  })

  it('filters decks by prefix/root/suffix kind and groups a word by kind', () => {
    const prefixDeck = buildRootDeck(words, roots, 'prefix')
    const groups = getRootGroups(words[1], roots)

    expect(prefixDeck.rootDecks).toHaveLength(2)
    expect(prefixDeck.rootDecks).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'trans-', kind: 'prefix', words: [words[0]] }),
    ]))
    expect(groups).toEqual({
      prefix: [],
      root: [roots[1]],
      suffix: [roots[2]],
    })
  })

  it('builds daily plan from unlearned and learned morphemes', () => {
    const progress = normalizeProgress({
      learnedMorphemeIds: ['port'],
    })

    const plan = getDailyPlan(roots, words, progress)

    expect(plan.newItems).toHaveLength(4)
    expect(new Set(plan.newItems.map((entry) => entry.id))).toEqual(new Set(['trans-', '-able', 'com-', 'mon']))
    expect(plan.reviewItems.map((entry) => entry.id)).toEqual(['port'])
  })

  it('keeps a generated daily plan stable after unrelated progress changes', () => {
    const progress = ensureDailyPlanProgress(normalizeProgress(), roots, words, '2026-05-18')
    const firstPlan = getDailyPlan(roots, words, progress)
    const changedProgress = setWordBook(progress, 'transport', 'mistake')
    const secondPlan = getDailyPlan(roots, words, changedProgress)

    expect(secondPlan.newItems.map((entry) => entry.id)).toEqual(firstPlan.newItems.map((entry) => entry.id))
    expect(secondPlan.reviewItems.map((entry) => entry.id)).toEqual(firstPlan.reviewItems.map((entry) => entry.id))
  })

  it('explains common with prefix and root memory clues', () => {
    const note = getWordMemoryNote(words[3], commonRoots)

    expect(note).toContain('com-')
    expect(note).toContain('共同，一起')
    expect(note).toContain('mon')
    expect(note).toContain('提醒，警告')
    expect(note).toContain('common')
  })
})
