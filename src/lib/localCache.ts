const DEFAULT_MAX_AGE = 1000 * 60 * 60 * 24 // 24 horas

interface CacheEntry<T> {
  timestamp: number
  value: T
}

function isLocalStorageAvailable() {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  } catch {
    return false
  }
}

function safeParse<T>(value: string | null): CacheEntry<T> | null {
  if (!value) return null
  try {
    return JSON.parse(value) as CacheEntry<T>
  } catch {
    return null
  }
}

export function getCachedData<T>(key: string, maxAge = DEFAULT_MAX_AGE): T | null {
  if (!isLocalStorageAvailable()) return null
  const raw = window.localStorage.getItem(key)
  const entry = safeParse<T>(raw)
  if (!entry || typeof entry.timestamp !== 'number') {
    window.localStorage.removeItem(key)
    return null
  }

  if (Date.now() - entry.timestamp > maxAge) {
    window.localStorage.removeItem(key)
    return null
  }

  return entry.value
}

export function setCachedData<T>(key: string, value: T) {
  if (!isLocalStorageAvailable()) return
  try {
    const entry: CacheEntry<T> = { timestamp: Date.now(), value }
    window.localStorage.setItem(key, JSON.stringify(entry))
  } catch {
    // ignore quota or serialization failures
  }
}

export function removeCachedData(key: string) {
  if (!isLocalStorageAvailable()) return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore failures
  }
}
