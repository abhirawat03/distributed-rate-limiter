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

### How the Request Flows:

1. **Traffic Entry (Nginx Load Balancer):**
   * Clients send requests to `http://localhost:3000`.
   * **Nginx** listens on port `3000` (mapped to its internal port `80`) and distributes requests using the **Round-Robin** algorithm alternately between `Gateway A` and `Gateway B`.

2. **API Gateways (Express Instances):**
   * Multiple replica gateway instances (`gateway-a` and `gateway-b`) run on Node.js/Express.
   * If one gateway crashes, Nginx automatically routes all traffic to the remaining active gateway, achieving high availability.

3. **Shared Distributed State (Redis):**
   * Gateways check rate-limits by communicating with a shared **Redis** container.
   * Because both gateways talk to the *same* Redis instance, they share rate-limit counters. If a user exhausts their limits on `Gateway A`, they are immediately blocked on `Gateway B`.

4. **Upstream Microservice (Dummy Backend):**
   * If the rate-limiter check succeeds, the gateway reverse-proxies the request to the upstream microservice (`backend` running on port `4000`).
   * The client receives the response from the microservice through the gateway, masking the internal architecture of the system.

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
|
+-- src/                              # API Gateway source code
|   +-- index.js                      # Gateway entry point (Express server)
|   +-- config/
|   |   \-- limits.json               # Dynamic per-route rate-limit rules
|   +-- limiters/
|   |   +-- slidingWindow.js          # Sliding Window Log algorithm (Redis Lua)
|   |   +-- tokenBucket.js            # Token Bucket algorithm (Redis Lua)
|   |   +-- fallback.js               # Local in-memory fallback (LRU CappedMap)
|   |   \-- naive.js                  # Naive GET-then-INCR limiter (race condition demo)
|   +-- middleware/
|   |   +-- auth.js                   # JWT authentication middleware
|   |   +-- rateLimiter.js            # Config-driven rate-limiter middleware
|   |   \-- proxy.js                  # Reverse proxy to upstream backend
|   \-- redis/
|       +-- client.js                 # Singleton ioredis client + Lua script loader
|       \-- scripts/
|           +-- slidingWindow.lua     # Atomic Lua: sliding window logic
|           \-- tokenBucket.lua       # Atomic Lua: token bucket logic
|
+-- dummy-backend/
|   \-- server.js                     # Mock upstream microservice (port 4000)
|
+-- nginx/
|   \-- nginx.conf                    # Nginx load balancer config (Round-Robin upstream)
|
+-- benchmarks/
|   \-- race-condition-demo.md        # Race condition demo: naive vs Lua scripts
|
+-- Dockerfile                        # Shared Docker image for gateway + backend
+-- docker-compose.yml                # Orchestrates all 5 containers
+-- package.json                      # Node.js dependencies and npm scripts
+-- .env                              # Local environment variables (not committed)
\-- .gitignore                        # Ignored files (node_modules, .env)
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
