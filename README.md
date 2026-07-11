# Distributed API Gateway & Rate Limiter

> A production-grade, distributed API Gateway with built-in rate limiting — built with **Node.js**, **Redis**, and **Nginx**.

---

## 📖 Table of Contents

1. [What is this project?](#-what-is-this-project)
2. [How it works (Architecture)](#-how-it-works-architecture)
3. [Key Features](#-key-features)
4. [Tech Stack](#-tech-stack)
5. [Folder Structure](#-folder-structure)
6. [How to Run](#-how-to-run)
7. [How to Test](#-how-to-test)
8. [API Endpoints](#-api-endpoints)
9. [Rate Limit Algorithms](#-rate-limit-algorithms)
10. [How Rate Limit Headers Work](#-how-rate-limit-headers-work)

---

## 💡 What is this project?

Imagine you are building a public API — like a weather app or a login service. If you don't add any limits, a single user (or an attacker) could send **millions of requests per second**, crashing your server or exhausting your database.

**Rate Limiting** is the solution. It restricts how many requests a user can make in a given time window.

This project builds a **distributed API Gateway** that:
- Sits in front of your actual backend services.
- Checks every incoming request against a rate limit.
- Blocks users who exceed their limit with a `429 Too Many Requests` response.
- Works across **multiple server instances** at the same time, so limits are shared and consistent.

---

## 🏗️ How it works (Architecture)

```
                        +-----------------------+
  Your Browser  ------> |   Nginx (Port 3000)   |  <-- Load Balancer
                        +----------+------------+
                                   |
                     +-------------+-------------+
                     |                           |
             +-------+-------+         +---------+-------+
             |   Gateway A   |         |   Gateway B     |  <-- API Gateways
             | (internal     |         | (internal       |      (Node.js/Express)
             |  port 3000)   |         |  port 3000)     |
             +-------+-------+         +---------+-------+
                     |                           |
                     +-------------+-------------+
                                   |
                           +-------+-------+
                           |     Redis     |  <-- Shared counter store
                           |  (port 6379)  |      (remembers request counts)
                           +-------+-------+
                                   |
                           +-------+-------+
                           | Dummy Backend |  <-- Upstream Microservice
                           |  (port 4000)  |      (your actual API)
                           +---------------+
```

### Step-by-Step Request Flow

| Step | What happens |
|------|-------------|
| **1. Client sends request** | Your browser or app sends a request to `http://localhost:3000` |
| **2. Nginx receives it** | Nginx (the Load Balancer) decides which gateway should handle it — alternating between Gateway A and B using **Round-Robin** |
| **3. Gateway verifies JWT** | The gateway checks the `Authorization` header. If a valid JWT token is present, it extracts the User ID. If no token, the user is treated as a guest (rate-limited by IP) |
| **4. Gateway checks rate limit** | The gateway looks up the user's request count in **Redis**. Both gateways share the same Redis, so limits are enforced globally |
| **5a. Allowed** | If the user is within limits, the gateway **proxies** the request to the Dummy Backend (port 4000) and returns the response |
| **5b. Blocked** | If the user exceeded the limit, the gateway immediately returns `429 Too Many Requests` — the backend is never contacted |

### Why two gateways?

- **High Availability:** If `Gateway A` crashes, all traffic automatically flows to `Gateway B`. No downtime.
- **Horizontal Scaling:** Both gateways share Redis state, so rate limits are accurate even when load is split.

---

## 🚀 Key Features

| Feature | Description |
|---------|-------------|
| **Distributed Rate Limiting** | Multiple gateway instances share rate-limit state through Redis. Limits apply globally, not per-server. |
| **Two Algorithms** | Supports **Sliding Window Log** (strict, accurate) and **Token Bucket** (burst-friendly) — configurable per route. |
| **JWT-Aware Limiting** | Identifies logged-in users by their JWT User ID. Guests are rate-limited by IP address instead. |
| **Atomic Lua Scripts** | Rate-limit logic runs as a single atomic Lua script inside Redis — prevents race conditions in high-concurrency scenarios. |
| **Fail-Open Fallback** | If Redis goes down, the gateway switches to local in-memory limiting automatically, so your API keeps running. |
| **Dynamic Configuration** | All rate-limit rules live in one JSON file (`limits.json`) — no code changes needed to adjust limits. |
| **Standard HTTP Headers** | Returns `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After` on every response. |

---

## 🛠️ Tech Stack

| Technology | Role |
|------------|------|
| **Node.js + Express** | API Gateway — handles requests, JWT auth, and rate-limit decisions |
| **Redis 7** | Stores request counters — shared between all gateway instances |
| **Nginx** | Load Balancer — distributes traffic between gateway instances |
| **Docker + Docker Compose** | Packages and runs all 5 services together with a single command |
| **ioredis** | Node.js Redis client — used to run Lua scripts atomically |
| **jsonwebtoken** | Decodes JWT tokens to extract the User ID for per-user limiting |

---

## 🗂️ Folder Structure

```
distributed-rate-limiter/
|
+-- src/                              # API Gateway application code
|   |
|   +-- index.js                      # Entry point: starts the Express server
|   |
|   +-- config/
|   |   \-- limits.json               # Rate-limit rules per route (edit this to change limits)
|   |
|   +-- middleware/
|   |   +-- auth.js                   # Reads JWT token and attaches user ID to the request
|   |   +-- rateLimiter.js            # Reads limits.json, picks algorithm, blocks if exceeded
|   |   \-- proxy.js                  # Forwards allowed requests to the backend service
|   |
|   +-- limiters/
|   |   +-- slidingWindow.js          # Sliding Window algorithm using Redis Lua
|   |   +-- tokenBucket.js            # Token Bucket algorithm using Redis Lua
|   |   +-- fallback.js               # In-memory limiter used when Redis is unavailable
|   |   \-- naive.js                  # Broken naive limiter (kept to demonstrate race conditions)
|   |
|   \-- redis/
|       +-- client.js                 # Creates and exports the Redis connection
|       \-- scripts/
|           +-- slidingWindow.lua     # Atomic Lua script for sliding window counting
|           \-- tokenBucket.lua       # Atomic Lua script for token bucket refill logic
|
+-- dummy-backend/
|   \-- server.js                     # A simple Express server pretending to be a real microservice
|
+-- nginx/
|   \-- nginx.conf                    # Nginx config: defines the two gateways as upstream servers
|
+-- benchmarks/
|   \-- race-condition-demo.md        # Explains the GET-then-INCR race condition and how Lua fixes it
|
+-- Dockerfile                        # Builds a single Docker image used by both gateway and backend
+-- docker-compose.yml                # Defines and connects all 5 containers
+-- package.json                      # Project dependencies and npm scripts
+-- .env                              # Your local secrets (JWT secret, Redis URL) — not committed to Git
\-- .gitignore                        # Tells Git to ignore node_modules, .env, etc.
```

---

## ▶️ How to Run

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and **running**.

### Start everything with one command

```bash
docker compose up --build
```

This command will:
1. Build the Docker image for the gateway and backend.
2. Start all 5 containers: **Nginx**, **Gateway A**, **Gateway B**, **Redis**, and the **Dummy Backend**.
3. Wire them all together on the same internal Docker network.

> Once you see `gateway-a` and `gateway-b` printing startup messages, the system is ready.

### Stop everything

```bash
docker compose down
```

---

## 🧪 How to Test

### Test 1 — Is Load Balancing working?

Run the health check 4 times. You should see the gateway alternating:

```powershell
# PowerShell
1..4 | ForEach-Object {
  (ConvertFrom-Json (Invoke-WebRequest -Uri http://localhost:3000/health -UseBasicParsing).Content).instance
}
```

**Expected output:**
```
gateway-a
gateway-b
gateway-a
gateway-b
```

> Each request is handled by a different gateway — that is Nginx doing its job.

---

### Test 2 — Is Rate Limiting working?

The `/search` endpoint uses **Token Bucket** with a limit of **20 requests per minute**.

Send 21 requests back-to-back:

```powershell
# PowerShell
1..21 | ForEach-Object {
  $status = try {
    $r = Invoke-WebRequest -Uri http://localhost:3000/search -UseBasicParsing
    "$($r.StatusCode) - Remaining: $($r.Headers['X-RateLimit-Remaining'])"
  } catch {
    "$($_.Exception.Response.StatusCode.value__) - Retry-After: $($_.Exception.Response.Headers['Retry-After'])"
  }
  Write-Host "Request $_ : $status"
}
```

**Expected output:**
```
Request 1  : 200 - Remaining: 19
Request 2  : 200 - Remaining: 18
...
Request 20 : 200 - Remaining: 0
Request 21 : 429 - Retry-After: 60
```

> The 21st request is blocked — the rate limiter is working correctly.

---

## 📡 API Endpoints

| Method | Path | Description | Algorithm | Limit |
|--------|------|-------------|-----------|-------|
| `GET` | `/health` | Health check — returns which gateway handled the request | None | Unlimited |
| `POST` | `/login` | Issues a signed JWT token — handled by the backend microservice | Sliding Window | 5 req / min |
| `GET` | `/search` | Simulates a search query | Token Bucket | 20 req / min |
| `GET` | `/data` | Simulates fetching user data | Token Bucket | 30 req / min |

---

## 📐 Rate Limit Algorithms

### 1. Sliding Window Log (used on `/login`)

**Best for:** Sensitive endpoints where you need strict, accurate limiting (login, password reset).

**How it works:**
- Every request timestamp is stored in a Redis sorted set (ZSET).
- On each new request, timestamps older than 1 minute are removed.
- If the remaining count is under the limit → allow. Otherwise → block.
- Because it uses exact timestamps, it is extremely accurate with no boundary exploits.

---

### 2. Token Bucket (used on `/search`, `/data`)

**Best for:** Read endpoints where some bursting is acceptable (search, browsing).

**How it works:**
- Each user starts with a "bucket" full of tokens (e.g., 20 tokens).
- Every request costs 1 token.
- Tokens refill gradually over time at a fixed rate.
- If the bucket has tokens → allow and deduct one. If empty → block.
- This naturally allows short bursts of traffic followed by a cooldown.

---

## 📊 How Rate Limit Headers Work

Every response from the gateway includes these standard headers so clients can see their current status:

| Header | Meaning |
|--------|---------|
| `X-RateLimit-Limit` | The maximum number of requests allowed in the window |
| `X-RateLimit-Remaining` | How many requests the user can still make right now |
| `X-RateLimit-Reset` | The Unix timestamp (seconds) when the limit resets |
| `Retry-After` | *(Only on 429 responses)* How many seconds to wait before retrying |
