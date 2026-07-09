import express from "express";
import { slidingWindowLimiter } from "./limiters/slidingWindow.js";

const app = express();

app.use(express.json());
app.use(slidingWindowLimiter);

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
  });
});

app.post("/login", (req, res) => {
  res.json({
    message: "gateway - coming soon",
  });
});

app.get("/search", (req, res) => {
  res.json({
    message: "gateway - coming soon",
    result: [],
  });
});

app.get("/data", (req, res) => {
  res.json({
    message: "gateway - coming soon",
  });
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => console.log(`Gateway on port ${PORT}`));
