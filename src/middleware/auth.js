import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "your_super_secret_key";

export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return next(); // No token, proceed as guest
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return next(); // Invalid format, proceed as guest
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Attach user payload (e.g. { id: 123, email: '...' })
    next();
  } catch (err) {
    // If token is invalid/expired, we could reject it or fallback.
    // Let's return a 401 Unauthorized since they passed a bad token.
    return res.status(401).json({ error: "Invalid token" });
  }
};
