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
      lastStudiedRootId: undefined,
    })
  })

  it('persists progress in localStorage', () => {
    saveProgress({
      mistakeWords: ['abide'],
      killedWords: ['abolish'],
      learnedMorphemeIds: ['port'],
      lastStudiedRootId: 'port',
    })

    expect(loadProgress()).toEqual({
      mistakeWords: ['abide'],
      killedWords: ['abolish'],
      learnedMorphemeIds: ['port'],
      lastStudiedRootId: 'port',
    })
  })
})
