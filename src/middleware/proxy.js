import { createProxyMiddleware } from "http-proxy-middleware";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";

export const proxyMiddleware = createProxyMiddleware({
  target: BACKEND_URL,
  changeOrigin: true, // handles host headers properly
  // Log proxy requests to the console
  pathFilter: ["/login", "/search", "/data"],
  on: {
    proxyReq: (proxyReq, req, res) => {
      console.log(`[Proxy] Forwarding request to: ${BACKEND_URL}${req.url}`);
    },
  },
});
