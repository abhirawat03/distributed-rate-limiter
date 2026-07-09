-- ARGV[1] = current timestamp (ms)
-- ARGV[2] = window size (ms)
-- ARGV[3] = max requests (limit)
-- KEYS[1] = redis key

local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])

-- Remove all requests older than the window (sliding!)
redis.call('ZREMRANGEBYSCORE', KEYS[1], 0, now - window)

-- Count how many requests are in the current window
local count = redis.call('ZCARD', KEYS[1])

-- If at limit, reject
if count >= limit then
  return 0
end

-- Add this request as a new entry (score = timestamp)
redis.call('ZADD', KEYS[1], now, now .. '-' .. math.random(1000000))

-- Auto-expire the key after the window
redis.call('PEXPIRE', KEYS[1], window)

return 1  -- allowed
