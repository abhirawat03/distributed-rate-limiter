# Distributed API Gateway & Rate Limiter

A production-grade, distributed API Gateway with built-in rate-limiting capabilities, built with Node.js/Express, Redis, and load-balanced using Nginx.

---

## 🏗️ Architecture Overview

```
                        ┌─────────────────────┐
  Clients ──────────►  │   nginx (LB :3000)   │
                        └────────┬────────────┘
                                 │
                    ┌────────────┴─────────────┐
                    ▼                          ▼
           ┌──────────────┐          ┌──────────────┐
           │  Gateway A   │          │  Gateway B   │  ← Express instances
           │  (port 3000) │          │  (port 3000) │     (Docker internal)
           └──────┬───────┘          └──────┬───────┘
                  │                         │
                  └──────────┬──────────────┘
                             ▼
                       ┌──────────┐
                       │  Redis   │  ← Shared rate-limit state
                       │  (:6379) │    (Docker internal)
                       └──────────┘
                             │
                             ▼
                      ┌──────────────┐
                      │ Dummy Backend│  ← Upstream microservice
                      │  (port 4000) │
                      └──────────────┘
```

---

## 🚀 Key Features

* **Multi-Instance Horizontal Scaling:** Multiple gateway instances share state through Redis, running behind Nginx.
* **Dual Algorithms Supported:**
  * **Sliding Window Log** (implemented via Lua for strict rate-limiting on sensitive endpoints like `/login`).
  * **Token Bucket** (implemented via Lua for burst-friendly read endpoints like `/search`).
* **Dynamic, Path-Based Rules:** Configuration is fully extracted to `src/config/limits.json` (no hardcoding).
* **JWT Authenticated Rate-Limiting:** Dynamically identifies logged-in users and enforces limits per User ID, falling back to IP address only for guests.
* **Fail-Open Resiliency (Fallback Mode):** Automatically catches Redis connection drops and switches to local in-memory rate-limiting maps to prevent API crashes.
* **RFC-Compliant Response Headers:** Sets `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After`.

---

## 🗂️ Folder Structure

```
distributed-rate-limiter/
├── src/
│   ├── index.js                  # Gateway entry point
│   ├── config/
│   │   └── limits.json           # Dynamic rate-limit rules configuration
│   ├── limiters/
│   │   ├── naive.js              # Deprecated naive GET-then-INCR limiter (broken)
│   │   ├── slidingWindow.js      # Sliding window Redis helper
│   │   ├── tokenBucket.js        # Token bucket Redis helper
│   │   └── fallback.js           # Local in-memory fallback limiters
│   ├── middleware/
│   │   ├── auth.js               # Optional JWT authentication middleware
│   │   ├── rateLimiter.js        # Main config-driven rate-limiter middleware
│   │   └── proxy.js              # Upstream reverse proxy middleware
│   └── redis/
│       ├── client.js             # Singleton Redis client
│       └── scripts/
│           ├── slidingWindow.lua # Atomic sliding window logic
│           └── tokenBucket.lua   # Atomic token bucket logic
├── dummy-backend/
│   └── server.js                 # Upstream microservice mock
├── nginx/
│   └── nginx.conf                # Nginx Load Balancer configuration
├── Dockerfile                    # Containerization configuration
├── docker-compose.yml            # Multi-service orchestration
└── benchmarks/
    └── race-condition-demo.md    # Documentation of naive vs Lua race conditions
```

---

## 🛠️ How to Run & Test

### Prerequisites
* Docker Desktop installed and running.

### 1. Start the Cluster
To start Nginx, Redis, both Gateways, and the Backend:
```bash
docker compose up --build
```

### 2. Verify Load Balancing
Call the health check multiple times. You will see requests alternating between instances:
```bash
# PowerShell
1..4 | ForEach-Object { (ConvertFrom-Json (Invoke-WebRequest -Uri http://localhost:3000/health -UseBasicParsing).Content).instance }
```
*Expected Output:*
```
gateway-a
gateway-b
gateway-a
gateway-b
```

### 3. Verify Rate Limiting
Fire 21 requests in rapid succession to the `/search` path (Token Bucket with limit of 20):
```bash
# PowerShell
1..21 | ForEach-Object { $status = try { $r = Invoke-WebRequest -Uri http://localhost:3000/search -UseBasicParsing; "$($r.StatusCode) - Remaining: $($r.Headers['X-RateLimit-Remaining'])" } catch { "$($_.Exception.Response.StatusCode.value__) - Retry-After: $($_.Exception.Response.Headers['Retry-After'])" }; Write-Host "Request $_ : $status" }
```
*Expected Output:*
```
Request 1 : 200 - Remaining: 19
Request 2 : 200 - Remaining: 18
...
Request 20 : 200 - Remaining: 0
Request 21 : 429 - Retry-After: 60
```
