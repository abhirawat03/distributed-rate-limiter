import express from "express";
import jwt from "jsonwebtoken";

const app = express();

app.use(express.json());

// Auth Service: issues a JWT token on successful login
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

app.get("/search", (req, res) => {
  res.json({
    message: "Search successful",
    result: [],
  });
});

app.get("/data", (req, res) => {
  res.json({
    message: "Here is your data",
  });
});

app.listen(4000, () => console.log("Dummy backend on port 4000"));
