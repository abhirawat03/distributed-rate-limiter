-- KEYS[1] = redis key
-- ARGV[1] = current timestamp (ms)
-- ARGV[2] = bucket capacity (max tokens)
-- ARGV[3] = refill rate (tokens per second)

local key = KEYS[1]
local now = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refillRate = tonumber(ARGV[3])

-- Read current bucket state (tokens + last refill time)
local data = redis.call('HMGET', key, 'tokens', 'lastRefill')
local tokens = tonumber(data[1]) or capacity
local lastRefill = tonumber(data[2]) or now

-- How many seconds passed since last refill?
local elapsed = (now - lastRefill) / 1000

-- Add new tokens based on time elapsed
local newTokens = math.floor(elapsed * refillRate)
tokens = math.min(capacity, tokens + newTokens)

-- Update last refill time only if tokens were added
if newTokens > 0 then
    lastRefill = now
end

-- No tokens left → reject
if tokens < 1 then
    redis.call('HSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
    redis.call('EXPIRE', key, 3600)  
    return 0  
end

-- Consume 1 token -> allow
tokens = tokens - 1
redis.call('HSET', key, 'tokens', tokens, 'lastRefill', lastRefill)
redis.call('EXPIRE', key, 3600)
return 1