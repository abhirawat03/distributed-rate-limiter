# Concurrency & Race Condition Benchmark Demo

In a distributed backend system, rate limiting can fail under high concurrency if state operations are not atomic. This document explains the **GET-then-INCR** race condition vulnerability and how our **Lua Script** solution resolves it.

---

## 1. The Vulnerability: Naive Limiter (GET-then-INCR)

The naive rate limiter (`src/limiters/naive.js`) performs two distinct round-trips to Redis:
1. `GET` the current request count.
2. `INCR` (increment) the count if it's below the limit.

### 🚨 The Race Condition Flow
Suppose the limit is **5 requests per minute**, and the current count is **4**:

```
Time   Gateway Instance A (Req 1)        Gateway Instance B (Req 2)        Redis State
───    ──────────────────────────        ──────────────────────────        ───────────
T1     GET count ────────────────────────────────────────────────────────► (Returns 4)
T2     ────────────────────────────────► GET count ──────────────────────► (Returns 4)
T3     (Count is 4 < 5, Allowed! ✅)
T4     ────────────────────────────────► (Count is 4 < 5, Allowed! ✅)
T5     INCR count ───────────────────────────────────────────────────────► (Count becomes 5)
T6     ────────────────────────────────► INCR count ─────────────────────► (Count becomes 6)
```

### 💥 The Result
Both requests were allowed through because they both read a count of `4` before either had a chance to increment it. 
* **The Limit was 5, but 6 requests succeeded.**
* In production, this allows attackers to bypass security boundaries, run rapid brute-force attacks, or overload downstream databases.

---

## 2. The Solution: Atomic Lua Scripts

The fixed limiter (`src/limiters/slidingWindow.js`) uses an **atomic Lua script** executed directly inside Redis.

### 🛡️ Why Lua is Safe
1. **Single-Threaded Execution:** Redis executes all commands and scripts sequentially in a single main thread.
2. **Atomicity:** When a Lua script runs, Redis blocks all other incoming commands until the script completes.
3. **No Network Gaps:** The check (comparing count) and the modification (adding/incrementing) happen in a single step inside Redis memory.

```
Time   Gateway Instance A (Req 1)        Gateway Instance B (Req 2)        Redis State
───    ──────────────────────────        ──────────────────────────        ───────────
T1     EVAL slidingWindow.lua ───────────────────────────────────────────► [Locks Engine]
                                                                           - Removes old items
                                                                           - Checks count (4)
                                                                           - Adds item
                                                                           - Returns 1 (Allow)
                                                                           [Unlocks Engine]
T2     ────────────────────────────────► EVAL slidingWindow.lua ─────────► [Locks Engine]
                                                                           - Removes old items
                                                                           - Checks count (5)
                                                                           - Returns 0 (Block)
                                                                           [Unlocks Engine]
```

---

## 3. How to Demonstrate the Race Condition

To verify this concurrency issue under load, you can run a tool like `autocannon` or `k6` against the Gateway running the naive limiter.

### Run concurrency test (100 parallel connections):
Using `autocannon` (Node.js load tester):
```bash
npm install -g autocannon
autocannon -c 100 -d 5 http://localhost:3000/search
```

* Under the **Naive Limiter**, you will notice that significantly more than the configured limit of requests bypass the limiter and receive `200 OK` responses.
* Under the **Lua Limiter**, exactly the allowed limit (e.g. 20) receive `200 OK` and all concurrent subsequent requests immediately receive `429 Too Many Requests`.
