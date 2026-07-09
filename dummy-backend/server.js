import express from "express";

const app = express();

app.use(express.json());

app.post("/login", (req, res) => {
  res.json({
    message: "Login successful",
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
