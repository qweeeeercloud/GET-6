import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Search,
  Trophy,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { cet6Metadata, cet6Roots, cet6Words } from './data/cet6'
import { loadProgress, saveProgress } from './lib/progressStorage'
import {
  buildRootDeck,
  getCoverageStats,
  getStudyQueue,
  getWordBook,
  setWordBook,
  type ProgressState,
  type WordBook,
  type WordEntry,
} from './lib/vocab'

type ViewMode = 'study' | 'mistakes' | 'killed'

const viewLabels: Record<ViewMode, string> = {
  study: '学习',
  mistakes: '错题本',
  killed: '斩词本',
}

function App() {
  const [progress, setProgress] = useState<ProgressState>(() => loadProgress())
  const [view, setView] = useState<ViewMode>('study')
  const [query, setQuery] = useState('')
  const [rootIndex, setRootIndex] = useState(0)

  const coverage = useMemo(() => getCoverageStats(cet6Words), [])
  const deck = useMemo(() => buildRootDeck(cet6Words, cet6Roots), [])
  const studyQueue = useMemo(() => getStudyQueue(cet6Words, progress), [progress])
  const normalizedRootIndex = wrapIndex(rootIndex, deck.rootDecks.length)
  const currentRoot = deck.rootDecks[normalizedRootIndex]
  const mistakeWords = useMemo(
    () => wordsByBook(cet6Words, progress, 'mistake'),
    [progress],
  )
  const killedWords = useMemo(
    () => wordsByBook(cet6Words, progress, 'killed'),
    [progress],
  )

  const visibleWords = useMemo(() => {
    const source =
      view === 'mistakes'
        ? mistakeWords
        : view === 'killed'
          ? killedWords
          : currentRoot.words.filter((entry) => getWordBook(progress, entry.word) !== 'killed')

    return filterWords(source, query)
  }, [currentRoot.words, killedWords, mistakeWords, progress, query, view])

  useEffect(() => {
    saveProgress(progress)
  }, [progress])

  function moveWord(word: string, book: WordBook) {
    setProgress((current) => setWordBook(current, word, book))
  }

  const activeCount =
    view === 'mistakes' ? mistakeWords.length : view === 'killed' ? killedWords.length : studyQueue.length

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">GET-6</p>
          <h1>六级词根背诵</h1>
        </div>
        <div className="search-box">
          <Search aria-hidden="true" size={18} />
          <input
            aria-label="搜索单词或释义"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索单词 / 释义"
          />
        </div>
      </header>

      <section className="stats-grid" aria-label="六级覆盖统计">
        <StatCard icon={<BookOpen />} label="六级词汇" value={cet6Metadata.total} />
        <StatCard icon={<CheckCircle2 />} label="词根覆盖" value={coverage.rooted} />
        <StatCard icon={<AlertCircle />} label="错题本" value={mistakeWords.length} />
        <StatCard icon={<Trophy />} label="斩词本" value={killedWords.length} />
      </section>

      <nav className="mode-tabs" aria-label="学习模式">
        {(['study', 'mistakes', 'killed'] as const).map((mode) => (
          <button
            className={view === mode ? 'active' : ''}
            key={mode}
            onClick={() => setView(mode)}
            type="button"
          >
            {viewLabels[mode]}
            <span>
              {mode === 'study'
                ? studyQueue.length
                : mode === 'mistakes'
                  ? mistakeWords.length
                  : killedWords.length}
            </span>
          </button>
        ))}
      </nav>

      <section className="workspace">
        {view === 'study' ? (
          <RootPanel
            currentRoot={currentRoot}
            index={normalizedRootIndex}
            total={deck.rootDecks.length}
            onPrevious={() => setRootIndex((current) => current - 1)}
            onNext={() => setRootIndex((current) => current + 1)}
          />
        ) : (
          <BookPanel count={activeCount} mode={view} />
        )}

        <section className="word-list" aria-label={`${viewLabels[view]}单词`}>
          {visibleWords.length > 0 ? (
            visibleWords.slice(0, 36).map((word) => (
              <WordCard
                key={word.word}
                progress={progress}
                word={word}
                onMove={moveWord}
              />
            ))
          ) : (
            <div className="empty-state">
              <p>没有匹配的单词</p>
            </div>
          )}
        </section>
      </section>
    </main>
  )
}

type StatCardProps = {
  icon: React.ReactNode
  label: string
  value: number
}

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <article className="stat-card">
      <span className="stat-icon">{icon}</span>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  )
}

type RootPanelProps = {
  currentRoot: ReturnType<typeof buildRootDeck>['rootDecks'][number]
  index: number
  total: number
  onPrevious: () => void
  onNext: () => void
}

function RootPanel({ currentRoot, index, onNext, onPrevious, total }: RootPanelProps) {
  return (
    <aside className="root-panel">
      <div className="root-meta">
        <span>
          {index + 1} / {total}
        </span>
        <div className="root-nav">
          <button aria-label="上一个词根" onClick={onPrevious} type="button">
            <ChevronLeft aria-hidden="true" size={18} />
          </button>
          <button aria-label="下一个词根" onClick={onNext} type="button">
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        </div>
      </div>
      <h2>{currentRoot.title}</h2>
      <p className="root-meaning">{currentRoot.meaning}</p>
      <p>{currentRoot.note}</p>
      <div className="root-count">{currentRoot.words.length} 个六级词</div>
    </aside>
  )
}

function BookPanel({ count, mode }: { count: number; mode: ViewMode }) {
  return (
    <aside className="root-panel book-panel">
      <p className="eyebrow">{viewLabels[mode]}</p>
      <h2>{count}</h2>
      <p>{mode === 'mistakes' ? '集中复习薄弱词。' : '已彻底掌握的词默认不进入学习队列。'}</p>
    </aside>
  )
}

type WordCardProps = {
  word: WordEntry
  progress: ProgressState
  onMove: (word: string, book: WordBook) => void
}

function WordCard({ onMove, progress, word }: WordCardProps) {
  const book = getWordBook(progress, word.word)

  return (
    <article className={`word-card ${book}`}>
      <div className="word-main">
        <div>
          <h3>{word.word}</h3>
          <span className="phonetic">{word.phonetic ? `/${word.phonetic}/` : '音标待补充'}</span>
        </div>
        <span className="status-pill">{bookLabel(book)}</span>
      </div>
      <p>{word.translation}</p>
      <div className="root-tags">
        {word.rootIds.length > 0 ? word.rootIds.map((root, index) => <span key={`${root}-${index}`}>{root}</span>) : <span>补充词汇</span>}
      </div>
      <div className="word-actions">
        <button onClick={() => onMove(word.word, 'mistake')} type="button">
          <AlertCircle aria-hidden="true" size={16} />
          加入错题本
        </button>
        <button onClick={() => onMove(word.word, 'killed')} type="button">
          <Trophy aria-hidden="true" size={16} />
          加入斩词本
        </button>
        {book !== 'study' ? (
          <button onClick={() => onMove(word.word, 'study')} type="button">
            <RotateCcw aria-hidden="true" size={16} />
            移回学习中
          </button>
        ) : null}
      </div>
    </article>
  )
}

function wordsByBook(words: WordEntry[], progress: ProgressState, book: Exclude<WordBook, 'study'>) {
  const selected = new Set(book === 'mistake' ? progress.mistakeWords : progress.killedWords)
  return words.filter((entry) => selected.has(entry.word))
}

function filterWords(words: WordEntry[], query: string) {
  const normalized = query.trim().toLowerCase()

  if (!normalized) {
    return words
  }

  return words.filter(
    (entry) =>
      entry.word.includes(normalized) ||
      entry.translation.toLowerCase().includes(normalized) ||
      entry.rootIds.some((root) => root.includes(normalized)),
  )
}

function bookLabel(book: WordBook) {
  if (book === 'mistake') {
    return '错题本'
  }

  if (book === 'killed') {
    return '斩词本'
  }

  return '学习中'
}

function wrapIndex(index: number, total: number) {
  return ((index % total) + total) % total
}

export default App
