import { beforeEach, describe, expect, it } from 'vitest'
import { loadProgress, saveProgress } from './progressStorage'

describe('progress storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('loads an empty progress state when storage is blank', () => {
    expect(loadProgress()).toEqual({
      mistakeWords: [],
      killedWords: [],
      learnedMorphemeIds: [],
      wordNotes: {},
      dailyPlan: undefined,
      lastStudiedRootId: undefined,
    })
  })

  it('persists progress in localStorage', () => {
    saveProgress({
      mistakeWords: ['abide'],
      killedWords: ['abolish'],
      learnedMorphemeIds: ['port'],
      wordNotes: {
        abide: '容易忘记释义',
      },
      dailyPlan: {
        date: '2026-05-18',
        newItemIds: ['trans-'],
        reviewItemIds: ['port'],
      },
      lastStudiedRootId: 'port',
    })

    expect(loadProgress()).toEqual({
      mistakeWords: ['abide'],
      killedWords: ['abolish'],
      learnedMorphemeIds: ['port'],
      wordNotes: {
        abide: '容易忘记释义',
      },
      dailyPlan: {
        date: '2026-05-18',
        newItemIds: ['trans-'],
        reviewItemIds: ['port'],
      },
      lastStudiedRootId: 'port',
    })
  })
})
