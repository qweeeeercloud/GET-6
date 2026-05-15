import { normalizeProgress, type ProgressState } from './vocab'

const storageKey = 'get-6-progress'

export function loadProgress(): ProgressState {
  try {
    const raw = localStorage.getItem(storageKey)

    if (!raw) {
      return normalizeProgress()
    }

    return normalizeProgress(JSON.parse(raw))
  } catch {
    return normalizeProgress()
  }
}

export function saveProgress(progress: ProgressState): void {
  localStorage.setItem(storageKey, JSON.stringify(normalizeProgress(progress)))
}
