import { describe, expect, it } from 'vitest'
import {
  buildRootDeck,
  getCoverageStats,
  getStudyQueue,
  normalizeProgress,
  setWordBook,
  type ProgressState,
  type WordEntry,
} from './vocab'

const words: WordEntry[] = [
  {
    word: 'transport',
    phonetic: "træn'spɔ:t",
    translation: 'vt. 运输; 传送',
    pos: 'v',
    tags: ['cet6'],
    rootIds: ['port'],
  },
  {
    word: 'portable',
    phonetic: "'pɔ:təbl",
    translation: 'a. 可携带的',
    pos: 'a',
    tags: ['cet6'],
    rootIds: ['port'],
  },
  {
    word: 'random',
    phonetic: "'rændəm",
    translation: 'a. 随机的',
    pos: 'a',
    tags: ['cet6'],
    rootIds: [],
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
  })

  it('excludes killed words from the default study queue while keeping mistakes visible first', () => {
    const progress = normalizeProgress({
      mistakeWords: ['random'],
      killedWords: ['transport'],
    })

    expect(getStudyQueue(words, progress).map((entry) => entry.word)).toEqual([
      'random',
      'portable',
    ])
  })
})

describe('vocab data helpers', () => {
  it('counts imported CET-6 coverage and rooted words', () => {
    expect(getCoverageStats(words)).toEqual({
      total: 3,
      rooted: 2,
      supplemental: 1,
    })
  })

  it('builds root decks and leaves unrooted words for supplemental learning', () => {
    const deck = buildRootDeck(words)

    expect(deck.rootDecks).toHaveLength(1)
    expect(deck.rootDecks[0]).toMatchObject({
      id: 'port',
      title: 'port',
      words: [words[0], words[1]],
    })
    expect(deck.supplementalWords).toEqual([words[2]])
  })
})
