local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])

-- Remove old elements
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - window)

-- Count remaining
local count = redis.call('ZCARD', KEYS[1])

-- Calculate reset time based on oldest item in set
local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
local resetAt = now + window
if #oldest > 0 then
  resetAt = tonumber(oldest[2]) + window
end

if count >= limit then
  -- Return { allowed=0, remaining=0, resetAt }
  return {0, 0, resetAt}
end

-- Add new request
redis.call('ZADD', KEYS[1], now, now .. '-' .. math.random(1000000))
redis.call('PEXPIRE', KEYS[1], window)

-- Return { allowed=1, remaining=limit - count - 1, resetAt }
return {1, limit - count - 1, resetAt}
