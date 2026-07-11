import express from "express";
import { rateLimiter } from "./middleware/rateLimiter.js";
import { optionalAuth } from "./middleware/auth.js";
import jwt from "jsonwebtoken";
import { proxyMiddleware } from "./middleware/proxy.js";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

// Auth & Rate Limiting are checked BEFORE proxying
app.use(optionalAuth);
app.use(rateLimiter);

// 1. Gateway local endpoint (login)
// We handle login locally to generate tokens
app.post("/login", (req, res) => {
  const userId = req.body.userId || 123;
  const secret = process.env.JWT_SECRET ?? "your_super_secret_key";
  const token = jwt.sign({ id: userId, email: "user@example.com" }, secret, {
    expiresIn: "1h",
  });
  res.json({
    message: "Login successful",
    token,
  });
});
// 2. Gateway local endpoint (health check)
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    instance: process.env.INSTANCE_ID ?? "gateway-1",
  });
});
// 3. Upstream proxied endpoints (/search, /data)
// Any other request goes to the dummy backend if it passes the rate limiter!
app.use(proxyMiddleware);

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`Gateway on port ${PORT}`));
