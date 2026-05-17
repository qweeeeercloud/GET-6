import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { cet6Roots, cet6Words } from './data/cet6'
import { buildRootDeck, getRootGroups, type RootEntry } from './lib/vocab'

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows CET-6 coverage and word-root learning content', () => {
    render(<App />)

    expect(screen.getByText(/六级词根背诵/)).toBeInTheDocument()
    expect(screen.getAllByText(/5407/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/错题本/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/斩词本/).length).toBeGreaterThan(0)
  })

  it('lets a learner move a word into mistake and killed books', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getAllByRole('button', { name: '加入错题本' })[0])
    expect(screen.getByRole('button', { name: /错题本\s*1/ })).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: '加入斩词本' })[0])
    expect(screen.getByRole('button', { name: /斩词本\s*1/ })).toBeInTheDocument()
  })

  it('lets a learner go back to the previous word root', async () => {
    const user = userEvent.setup()

    render(<App />)

    expect(screen.getByText(/1 \/ \d+/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '下一个构词卡片' }))
    expect(screen.getByText(/2 \/ \d+/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '上一个构词卡片' }))
    expect(screen.getByText(/1 \/ \d+/)).toBeInTheDocument()
  })

  it('shows morphology filters and grouped prefix labels', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(screen.getByRole('button', { name: '前缀' }))

    expect(screen.getByText(/构词卡片/)).toBeInTheDocument()
    expect(screen.getAllByText(/^前缀:/).length).toBeGreaterThan(0)
  })
  it('opens the matching morphology card when a word tag is clicked', async () => {
    const user = userEvent.setup()
    const target = getVisibleMorphemeTarget()

    render(<App />)

    await user.click(screen.getAllByRole('button', { name: `查看构词 ${target.title}` })[0])

    expect(screen.getByRole('heading', { level: 2, name: target.title })).toBeInTheDocument()
  })

  it('returns from killed book to study mode when a morphology tag is clicked', async () => {
    const user = userEvent.setup()
    const target = getVisibleMorphemeTarget()

    render(<App />)

    await user.click(screen.getAllByRole('button', { name: '加入斩词本' })[0])
    await user.click(screen.getByRole('button', { name: /^斩词本\s*1$/ }))
    await user.click(screen.getAllByRole('button', { name: `查看构词 ${target.title}` })[0])

    expect(screen.getByRole('button', { name: /学习/ })).toHaveClass('active')
    expect(screen.getByRole('heading', { level: 2, name: target.title })).toBeInTheDocument()
  })
})

function getVisibleMorphemeTarget(): RootEntry {
  const deck = buildRootDeck(cet6Words, cet6Roots)
  const firstRoot = deck.rootDecks[0]
  const visibleWord = firstRoot.words
    .slice(0, 36)
    .find((word) => getRootGroups(word, cet6Roots).prefix.length > 0)

  if (!visibleWord) {
    throw new Error('Expected a visible word with a prefix morpheme')
  }

  return getRootGroups(visibleWord, cet6Roots).prefix[0]
}
