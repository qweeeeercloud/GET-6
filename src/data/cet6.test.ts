import { describe, expect, it } from 'vitest'
import { cet6Metadata, cet6Roots, cet6Words } from './cet6'

describe('CET-6 dataset', () => {
  it('imports a full CET-6-sized word list from ECDICT', () => {
    expect(cet6Metadata.source).toContain('ECDICT')
    expect(cet6Words.length).toBeGreaterThan(5000)
    expect(cet6Metadata.total).toBe(cet6Words.length)
  })

  it('keeps every imported word learnable with a Chinese definition', () => {
    expect(cet6Words.every((entry) => entry.word && entry.translation)).toBe(true)
  })

  it('contains both rooted words and supplemental words', () => {
    const rooted = cet6Words.filter((entry) => entry.rootIds.length > 0)
    const supplemental = cet6Words.filter((entry) => entry.rootIds.length === 0)

    expect(cet6Roots.length).toBeGreaterThan(100)
    expect(rooted.length).toBeGreaterThan(1000)
    expect(supplemental.length).toBeGreaterThan(0)
  })

  it('preserves prefix/root/suffix categories from the word-root source', () => {
    const rootsById = new Map(cet6Roots.map((entry) => [entry.id, entry]))
    const prefixCount = cet6Roots.filter((entry) => entry.kind === 'prefix').length
    const wordWithMixedParts = cet6Words.find((word) => {
      const kinds = new Set(word.rootIds.map((id) => rootsById.get(id)?.kind))
      return kinds.has('prefix') && kinds.has('root') && kinds.has('suffix')
    })

    expect(prefixCount).toBeGreaterThan(50)
    expect(cet6Roots.some((entry) => entry.kind === 'suffix')).toBe(true)
    expect(cet6Roots.some((entry) => entry.kind === 'root')).toBe(true)
    expect(wordWithMixedParts).toBeDefined()
  })
})
