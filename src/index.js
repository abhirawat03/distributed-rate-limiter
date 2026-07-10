import express from "express";
import { slidingWindowLimiter } from "./limiters/slidingWindow.js";
import { tokenBucketLimiter } from "./limiters/tokenBucket.js";

const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
  });
});

// /login → sliding window (strict, 5 per 60s)
app.post("/login", slidingWindowLimiter, (req, res) => {
  res.json({
    message: "gateway - coming soon",
  });
});

// /search → token bucket (burst-friendly, 20 capacity, 0.33/sec refill)
app.get("/search", tokenBucketLimiter, (req, res) => {
  res.json({
    message: "gateway - coming soon",
    result: [],
  });
});

// /data → sliding window (strict)
app.get("/data", slidingWindowLimiter, (req, res) => {
  res.json({
    message: "gateway - coming soon",
  });
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`Gateway on port ${PORT}`));
