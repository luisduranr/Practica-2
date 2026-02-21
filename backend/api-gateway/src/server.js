require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { createProxyMiddleware } = require("http-proxy-middleware");
const app = express();

app.use(cors());
//app.use(express.json());

// Health check (DevSecOps)
app.get("/health", (_req, res) => {
  res.json({ status: "api-gateway OK" });
});

const USERS_SERVICE_URL =
  process.env.USERS_SERVICE_URL || "http://localhost:3001";
const ACADEMIC_SERVICE_URL =
  process.env.ACADEMIC_SERVICE_URL || "http://localhost:3002";

// AUTH → users-service
app.use(
  "/auth",
  createProxyMiddleware({
    target: USERS_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/auth": "" },
  })
);

// COURSES → academic-service
app.use(
  "/courses",
  createProxyMiddleware({
    target: ACADEMIC_SERVICE_URL,
    changeOrigin: true,
    pathRewrite: { "^/courses": "/" },
  })
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 API Gateway running on port ${PORT}`);
});