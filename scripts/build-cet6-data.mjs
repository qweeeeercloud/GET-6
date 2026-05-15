import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dictPath = resolve(projectRoot, 'node_modules/ecdict/data/dict.json')
const rootsPath = resolve(projectRoot, 'node_modules/ecdict/data/wordroot.json')
const outPath = resolve(projectRoot, 'src/data/cet6.ts')

const dict = JSON.parse(readFileSync(dictPath, 'utf8'))
const rootSource = JSON.parse(readFileSync(rootsPath, 'utf8'))

const rootMeaningZh = {
  '-able': '能够，可以被',
  '-al': '行为、结果；与……有关',
  '-ance': '状态、性质或行为',
  '-ant': '正在做……的；做……的人或物',
  '-ary': '相关的人、物、地点',
  '-ate': '使成为，造成，做',
  '-ation': '行为、过程或结果',
  '-ful': '充满，具有',
  '-ion': '行为、过程或结果',
  '-ite': '处于某种状态的人或物',
  '-ive': '倾向于，具有……性质',
  '-ize': '使成为，使……化',
  '-ment': '行为、过程或结果',
  '-ous': '充满，具有……特征',
  '-ty': '状态或性质',
  '-ure': '行为或过程',
  act: '做，驱动',
  allo: '其他，不同',
  cap: '头，抓住，取得',
  'com-': '共同，一起',
  'con-': '共同，一起',
  cor: '心',
  cur: '关心，照料；跑动',
  'dis-': '不，分开，反向',
  ec: '向外，在外',
  fac: '做，制造',
  fer: '携带，带来',
  her: '黏着，附着',
  lat: '侧面；携带',
  leg: '法律；选择；阅读',
  man: '手',
  ment: '思想，心智',
  min: '小，使变小',
  mit: '发送，放出',
  mon: '提醒，警告',
  nat: '出生，天生',
  par: '相等，准备',
  pos: '放置，位置',
  'pre-': '在前，预先',
  'pro-': '向前，在前',
  ras: '刮，擦',
  reg: '统治，规则，引导',
  sta: '站立，稳定',
  ten: '握住，保持',
  the: '神',
  'tra-': '穿过，越过',
  tri: '三',
  ver: '真实',
}

const rootEntries = rootSource
  .map((root) => {
    const rootTokens = normalizeRootTokens(root.root)
    const examples = normalizeExamples(root.example)

    if (rootTokens.length === 0) {
      return null
    }

    const meaning = chineseMeaning(rootTokens[0], root.meaning)

    return {
      id: rootTokens[0],
      title: rootTokens.join('/'),
      meaning,
      origin: root.origin ? String(root.origin) : undefined,
      note: buildRootNote(rootTokens, meaning, root.origin),
      tokens: rootTokens,
      examples,
    }
  })
  .filter(Boolean)

const seenWords = new Set()
const cet6Words = Object.values(dict)
  .filter((entry) => String(entry.tag || '').split(/\s+/).includes('cet6'))
  .filter((entry) => {
    const word = normalizeWord(entry.word)
    const keep = word && !seenWords.has(word) && String(entry.translation || '').trim()
    if (keep) {
      seenWords.add(word)
    }
    return keep
  })
  .map((entry) => {
    const word = normalizeWord(entry.word)
    return {
      word,
      phonetic: String(entry.phonetic || ''),
      translation: cleanTranslation(entry.translation),
      pos: String(entry.pos || guessPos(entry.translation)),
      tags: String(entry.tag || '').split(/\s+/).filter(Boolean),
      rootIds: findRootIds(word, rootEntries),
    }
  })
  .sort((left, right) => left.word.localeCompare(right.word))

const usedRootIds = new Set(cet6Words.flatMap((word) => word.rootIds))
const cet6Roots = rootEntries
  .filter((root) => usedRootIds.has(root.id))
  .map(({ id, title, meaning, origin, note }) => ({
    id,
    title,
    meaning,
    origin,
    note,
  }))
  .sort((left, right) => left.title.localeCompare(right.title))

const generated = `import type { RootEntry, WordEntry } from '../lib/vocab'

export const cet6Metadata = {
  source: 'ECDICT via npm package ecdict, filtered by tag cet6',
  generatedAt: ${JSON.stringify(new Date().toISOString())},
  total: ${cet6Words.length},
  rooted: ${cet6Words.filter((word) => word.rootIds.length > 0).length},
  supplemental: ${cet6Words.filter((word) => word.rootIds.length === 0).length},
} as const

export const cet6Roots = ${JSON.stringify(cet6Roots, null, 2)} satisfies RootEntry[]

export const cet6Words = ${JSON.stringify(cet6Words, null, 2)} satisfies WordEntry[]
`

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, generated, 'utf8')

console.log(
  `Generated ${cet6Words.length} CET-6 words, ${cet6Roots.length} roots, ` +
    `${cet6Words.filter((word) => word.rootIds.length > 0).length} rooted words.`,
)

function findRootIds(word, roots) {
  const matches = []

  for (const root of roots) {
    const exampleMatch = root.examples.includes(word)
    const tokenMatch = root.tokens.some((token) => rootTokenMatchesWord(token, word))

    if (exampleMatch || tokenMatch) {
      matches.push(root.id)
    }

    if (matches.length === 3) {
      break
    }
  }

  return matches
}

function rootTokenMatchesWord(token, word) {
  const clean = token.replace(/^-|-$/g, '')

  if (clean.length < 3) {
    return false
  }

  if (token.startsWith('-')) {
    return word.endsWith(clean)
  }

  if (token.endsWith('-')) {
    return word.startsWith(clean)
  }

  return word.includes(clean)
}

function normalizeRootTokens(tokens) {
  return []
    .concat(tokens || [])
    .map((token) => String(token).replace(/\d+$/g, '').trim().toLowerCase())
    .filter(Boolean)
}

function normalizeExamples(examples) {
  return []
    .concat(examples || [])
    .map((example) => normalizeWord(String(example).replace(/\d+$/g, '')))
    .filter(Boolean)
}

function normalizeWord(word) {
  return String(word || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z-]/g, '')
}

function cleanTranslation(translation) {
  return String(translation || '')
    .replace(/\\n/g, '\n')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join('；')
}

function guessPos(translation) {
  const match = String(translation || '').match(/^([a-z.]+)/i)
  return match?.[1] || ''
}

function buildRootNote(tokens, meaning, origin) {
  const rootText = tokens.join('/')
  const originText = origin ? `，来源 ${origin}` : ''
  return `${rootText} 表示“${meaning || '相关含义'}”${originText}，优先用它寻找同族词。`
}

function chineseMeaning(rootId, meaning) {
  const mapped = rootMeaningZh[rootId]

  if (mapped) {
    return mapped
  }

  return String(meaning || '词根/词缀线索')
}
