import express from "express";
import { rateLimiter } from "./middleware/rateLimiter.js";
import { optionalAuth } from "./middleware/auth.js";
import jwt from "jsonwebtoken";

const app = express();

app.use(express.json());
app.use(optionalAuth);
app.use(rateLimiter);

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
  });
});

// /login → sliding window (strict, 5 per 60s)
app.post("/login", (req, res) => {
  const userId = req.body.userId; // fallback to user 123
  const secret = process.env.JWT_SECRET ?? "your_super_secret_key";

  // Sign a JWT token with the user's ID
  const token = jwt.sign({ id: userId, email: "user@example.com" }, secret, {
    expiresIn: "1h",
  });

  res.json({
    message: "Login successful",
    token,
  });
});

// /search → token bucket (burst-friendly, 20 capacity, 0.33/sec refill)
app.get("/search", (req, res) => {
  res.json({
    message: "gateway - coming soon",
    result: [],
  });
});

// /data → sliding window (strict)
app.get("/data", (req, res) => {
  res.json({
    message: "gateway - coming soon",
  });
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`Gateway on port ${PORT}`));
