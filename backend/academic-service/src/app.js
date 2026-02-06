// src/app.js
const express = require("express");
const cors = require("cors");
const coursesRoutes = require("./routes/courses.routes");

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json());

// Health check (útil para DevSecOps / Docker)
app.get("/health", (req, res) => {
  res.status(200).json({ status: "academic-service OK" });
});

// Rutas del dominio académico
app.use("/", coursesRoutes);

module.exports = app;