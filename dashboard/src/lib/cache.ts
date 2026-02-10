interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private maxSize: number;
  private cleanupIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(maxSize = 100, cleanupIntervalMs = 60_000) {
    this.maxSize = maxSize;
    this.cleanupIntervalId = setInterval(() => this.cleanup(), cleanupIntervalMs);
  }

  destroy(): void {
    if (this.cleanupIntervalId) {
      clearInterval(this.cleanupIntervalId);
      this.cleanupIntervalId = null;
    }
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    const existingEntry = this.cache.has(key);
    
    if (!existingEntry && this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    if (existingEntry) {
      this.cache.delete(key);
    }
    
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  get size(): number {
    return this.cache.size;
  }
}

export const usageCache = new LRUCache<unknown>(50);
export const proxyModelsCache = new LRUCache<unknown>(10);

export const CACHE_TTL = {
  USAGE: 30_000,
  PROXY_MODELS: 60_000,
} as const;

export const CACHE_KEYS = {
  usage: (userId: string) => `usage:${userId}`,
  proxyModels: (proxyUrl: string, apiKey: string) => `proxy-models:${proxyUrl}:${apiKey.slice(-8)}`,
} as const;

export function invalidateUsageCaches(): void {
  usageCache.invalidatePattern(/^usage:/);
}

export function invalidateProxyModelsCache(): void {
  proxyModelsCache.invalidatePattern(/^proxy-models:/);
}
