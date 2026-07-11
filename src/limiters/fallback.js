// A simple, dependency-free LRU (Least Recently Used) cache to prevent Out of Memory (OOM) attacks
class CappedMap {
  constructor(maxSize) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  has(key) {
    return this.cache.has(key);
  }

  get(key) {
    if (!this.cache.has(key)) return undefined;
    // Move key to the end to mark it as most recently used
    const val = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, val);
    return val;
  }

  set(key, val) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict the oldest key (first item in the Map iterator)
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, val);
  }

  entries() {
    return this.cache.entries();
  }

  delete(key) {
    this.cache.delete(key);
  }
}

// Limit the cache to 10,000 active mappings
const localCache = new CappedMap(10000);

// Keep the cleanup interval to prune expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of localCache.entries()) {
    if (Array.isArray(val)) {
      if (val.length === 0 || now - val[val.length - 1] > 3600 * 1000) {
        localCache.delete(key);
      }
    } else {
      if (now - val.lastRefill > 3600 * 1000) {
        localCache.delete(key);
      }
    }
  }
}, 300 * 1000).unref(); // unref prevents this timer from keeping the Node process open

// 1. Sliding Window in-memory fallback
export const checkFallbackSlidingWindow = (ip, path, limit, windowSec) => {
  const key = `fallback:window:${ip}:${path}`;
  const now = Date.now();
  const windowMs = windowSec * 1000;

  if (!localCache.has(key)) {
    localCache.set(key, []);
  }

  let timestamps = localCache.get(key);

  // Filter out any timestamps older than the current window
  timestamps = timestamps.filter((t) => t > now - windowMs);

  // Calculate when the oldest request will expire to find the reset time
  const oldest = timestamps[0];
  const resetAt = oldest ? oldest + windowMs : now + windowMs;

  if (timestamps.length >= limit) {
    localCache.set(key, timestamps);
    return { allowed: 0, remaining: 0, resetAt };
  }

  // Record this request
  timestamps.push(now);
  localCache.set(key, timestamps);

  return { allowed: 1, remaining: limit - timestamps.length, resetAt };
};

// 2. Token Bucket in-memory fallback
export const checkFallbackTokenBucket = (ip, path, capacity, refillPerSec) => {
  const key = `fallback:bucket:${ip}:${path}`;
  const now = Date.now();

  if (!localCache.has(key)) {
    localCache.set(key, { tokens: capacity, lastRefill: now });
  }

  const bucket = localCache.get(key);
  const elapsed = (now - bucket.lastRefill) / 1000;
  const newTokens = Math.floor(elapsed * refillPerSec);

  // Add new tokens, capped at capacity
  let tokens = Math.min(capacity, bucket.tokens + newTokens);
  let lastRefill = bucket.lastRefill;

  if (newTokens > 0) {
    lastRefill = now;
  }

  const resetAt = now + Math.ceil(((capacity - tokens) / refillPerSec) * 1000);

  if (tokens < 1) {
    bucket.tokens = tokens;
    bucket.lastRefill = lastRefill;
    return { allowed: 0, remaining: 0, resetAt };
  }

  // Consume 1 token
  tokens = tokens - 1;
  bucket.tokens = tokens;
  bucket.lastRefill = lastRefill;

  return { allowed: 1, remaining: tokens, resetAt };
};
