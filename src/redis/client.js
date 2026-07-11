import Redis from "ioredis";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = new Redis(process.env.REDIS_URL);

client.on("connect", () => console.log("Redis connected"));
client.on("error", (err) => console.log("Redis error", err));

// Load Lua script strings once on startup
const slidingWindowLua = readFileSync(
  join(__dirname, "./scripts/slidingWindow.lua"),
  "utf-8",
);
const tokenBucketLua = readFileSync(
  join(__dirname, "./scripts/tokenBucket.lua"),
  "utf-8",
);

// Define custom commands on the client.
// ioredis handles registering them via SCRIPT LOAD and calling them via EVALSHA!
client.defineCommand("checkSlidingWindowLua", {
  numberOfKeys: 1,
  lua: slidingWindowLua,
});

client.defineCommand("checkTokenBucketLua", {
  numberOfKeys: 1,
  lua: tokenBucketLua,
});

export default client;
