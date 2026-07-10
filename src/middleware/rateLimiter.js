import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { checkSlidingWindow } from "../limiters/slidingWindow.js";
import { checkTokenBucket } from "../limiters/tokenBucket.js";
import {
  checkFallbackSlidingWindow,
  checkFallbackTokenBucket,
} from "../limiters/fallback.js";

const _dirname = dirname(fileURLToPath(import.meta.url));

// Read dynamic limits config
const limitsConfig = JSON.parse(
  readFileSync(join(_dirname, "../config/limits.json"), "utf-8"),
);

export const rateLimiter = async (req, res, next) => {
  const rule = limitsConfig[req.path];

  //If no rule matches this path, allow the request to proceed
  if (!rule) {
    return next();
  }

  // Identify client: use user ID if logged in (from JWT), otherwise fallback to IP
  const identifier = req.user ? `user:${req.user.id}` : `ip:${req.ip}`;

  let limitResult;

  try {
    // Try to use Redis first
    if (rule.algorithm == "sliding_window") {
      limitResult = await checkSlidingWindow(
        identifier,
        req.path,
        rule.limit,
        rule.windowSec,
      );
    } else if (rule.algorithm == "token_bucket") {
      limitResult = await checkTokenBucket(
        identifier,
        req.path,
        rule.capacity,
        rule.refillPerSec,
      );
    }
  } catch (err) {
    // If Redis is down, log a warning and use the in-memory fallback!
    console.warn(
      "⚠️ Redis unavailable, falling back to local memory rate limiting:",
      err.message,
    );

    if (rule.algorithm == "sliding_window") {
      limitResult = checkFallbackSlidingWindow(
        identifier,
        req.path,
        rule.limit,
        rule.windowSec,
      );
    } else if (rule.algorithm == "token_bucket") {
      limitResult = checkFallbackTokenBucket(
        identifier,
        req.path,
        rule.capacity,
        rule.refillPerSec,
      );
    }
  }

  if (!limitResult) {
    return next();
  }

  const { allowed, remaining, resetAt } = limitResult;
  const limitValue = rule.limit || rule.capacity;

  // Set RFC-compliant rate limit headers
  res.setHeader("X-RateLimit-Limit", limitValue);
  res.setHeader("X-RateLimit-Remaining", Math.max(0, remaining));
  res.setHeader("X-RateLimit-Reset", Math.floor(resetAt / 1000)); // reset time in seconds

  if (allowed === 0) {
    // Retry-After header should specify how many seconds the client has to wait
    const retryAfter = Math.max(0, Math.ceil((resetAt - Date.now()) / 1000));
    res.setHeader("Retry-After", retryAfter);
    return res.status(429).json({ error: "Too many requests" });
  }

  next();
};
