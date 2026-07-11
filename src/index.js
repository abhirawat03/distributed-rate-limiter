import express from "express";
import { rateLimiter } from "./middleware/rateLimiter.js";
import { optionalAuth } from "./middleware/auth.js";
import { proxyMiddleware } from "./middleware/proxy.js";

const app = express();

// 1. Verify JWT token (if present) and attach user to request
app.use(optionalAuth);

// 2. Check rate limit — block if exceeded, allow if within limit
app.use(rateLimiter);

// 3. Gateway health check (used by Nginx & orchestrators like Kubernetes)
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    instance: process.env.INSTANCE_ID ?? "gateway-1",
  });
});

// 4. Forward all other requests to the upstream microservice
app.use(proxyMiddleware);

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`Gateway on port ${PORT}`));
