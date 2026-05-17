import { describe, expect, it } from 'vitest'
import {
  buildRootDeck,
  getCoverageStats,
  getRootGroups,
  getStudyQueue,
  normalizeProgress,
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
    const deck = buildRootDeck(words, roots)

    expect(deck.rootDecks).toHaveLength(3)
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

    expect(prefixDeck.rootDecks).toEqual([
      expect.objectContaining({ id: 'trans-', kind: 'prefix', words: [words[0]] }),
    ])
    expect(groups).toEqual({
      prefix: [],
      root: [roots[1]],
      suffix: [roots[2]],
    })
  })
})
