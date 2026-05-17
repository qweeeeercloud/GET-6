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
  'a-': '不，无；向，处于',
  'ab-': '离开，偏离',
  'ad-': '向，靠近，加强',
  'ante-': '在前，先于',
  'anti-': '反对，抗',
  'auto-': '自己，自动',
  'bi-': '二，双',
  'co-': '共同，一起',
  'com-': '共同，一起',
  'con-': '共同，一起',
  'contra-': '反对，相反',
  'de-': '向下，离开，否定',
  'di-': '二，双',
  'dis-': '不，分开，反向',
  'en-': '使成为，进入',
  'ex-': '向外，前任',
  'extra-': '在外，额外',
  'fore-': '在前，预先',
  'hyper-': '过度，超过',
  'il-': '不，无',
  'im-': '不，无；进入',
  'in-': '不，无；进入',
  'inter-': '在……之间，相互',
  'intro-': '向内，内部',
  'ir-': '不，无',
  'macro-': '大，长',
  'micro-': '微，小',
  'mis-': '错误，坏',
  'mono-': '单一',
  'non-': '不，非',
  'over-': '过度，在上方',
  'para-': '在旁，类似',
  'post-': '在后，之后',
  'pre-': '在前，预先',
  'pro-': '向前，支持，代替',
  're-': '再次，回',
  'retro-': '向后，回顾',
  'sub-': '在下，次级',
  'super-': '在上，超过',
  'syn-': '共同，一起',
  'trans-': '穿过，转变',
  'tri-': '三',
  'un-': '不，反向',
  'under-': '在下，不足',
  'up-': '向上，提高',
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
  cor: '心',
  cur: '关心，照料；跑动',
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
  ras: '刮，擦',
  reg: '统治，规则，引导',
  sta: '站立，稳定',
  ten: '握住，保持',
  the: '神',
  ver: '真实',
}

const rootEntries = rootSource
  .map((root) => {
    const rootTokens = normalizeRootTokens(root.root)
    const examples = normalizeExamples(root.example)

    if (rootTokens.length === 0) {
      return null
    }

    const kind = getMorphemeKind(root.class, rootTokens[0])
    const meaning = chineseMeaning(rootTokens[0], root.meaning)

    return {
      id: rootTokens[0],
      title: rootTokens.join('/'),
      meaning,
      origin: root.origin ? String(root.origin) : undefined,
      note: buildRootNote(rootTokens, meaning, root.origin, kind),
      kind,
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
  .map(({ id, title, meaning, origin, note, kind }) => ({
    id,
    title,
    meaning,
    origin,
    note,
    kind,
  }))
  .sort((left, right) => left.title.localeCompare(right.title))

const generated = `import type { RootEntry, WordEntry } from '../lib/vocab'

export const cet6Metadata = {
  source: 'ECDICT via npm package ecdict, filtered by tag cet6',
  generatedAt: ${JSON.stringify(new Date().toISOString())},
  total: ${cet6Words.length},
  rooted: ${cet6Words.filter((word) => word.rootIds.length > 0).length},
  supplemental: ${cet6Words.filter((word) => word.rootIds.length === 0).length},
  prefixes: ${cet6Roots.filter((root) => root.kind === 'prefix').length},
  roots: ${cet6Roots.filter((root) => root.kind === 'root').length},
  suffixes: ${cet6Roots.filter((root) => root.kind === 'suffix').length},
} as const

export const cet6Roots = ${JSON.stringify(cet6Roots, null, 2)} satisfies RootEntry[]

export const cet6Words = ${JSON.stringify(cet6Words, null, 2)} satisfies WordEntry[]
`

mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, generated, 'utf8')

console.log(
  `Generated ${cet6Words.length} CET-6 words, ${cet6Roots.length} morphemes, ` +
    `${cet6Roots.filter((root) => root.kind === 'prefix').length} prefixes.`,
)

function findRootIds(word, roots) {
  const matches = []

  for (const root of roots) {
    const exampleMatch = root.examples.includes(word)
    const tokenMatch = root.tokens.some((token) => rootTokenMatchesWord(token, word))

    if (exampleMatch || tokenMatch) {
      matches.push({ id: root.id, kind: root.kind, score: exampleMatch ? 2 : 1 })
    }
  }

  return [...new Map(
    matches
      .sort((left, right) => right.score - left.score || kindRank(left.kind) - kindRank(right.kind))
      .map((match) => [match.id, match.id]),
  ).values()].slice(0, 5)
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

function getMorphemeKind(className, token) {
  const normalizedClass = String(className || '').toLowerCase()

  if (normalizedClass.includes('prefix') || token.endsWith('-')) {
    return 'prefix'
  }

  if (normalizedClass.includes('suffix') || token.startsWith('-')) {
    return 'suffix'
  }

  return 'root'
}

function kindRank(kind) {
  return { prefix: 0, root: 1, suffix: 2 }[kind] ?? 3
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

function buildRootNote(tokens, meaning, origin, kind) {
  const rootText = tokens.join('/')
  const originText = origin ? `，来源 ${origin}` : ''
  const kindText = { prefix: '前缀', root: '词根', suffix: '后缀' }[kind]
  return `${rootText} 是${kindText}，表示“${meaning || '相关含义'}”${originText}，优先用它寻找同族词。`
}

function chineseMeaning(rootId, meaning) {
  const mapped = rootMeaningZh[rootId]

  if (mapped) {
    return mapped
  }

  return String(meaning || '构词线索')
}
