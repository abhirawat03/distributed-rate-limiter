import Redis from "ioredis";

const client = new Redis(process.env.REDIS_URL);

client.on("connect", () => console.log("Redis connected"));
client.on("error", (err) => console.log("Redis error", err));

export default client;
