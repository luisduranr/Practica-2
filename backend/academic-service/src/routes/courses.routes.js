const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const { getCourses } = require("../controllers/courses.controller");

const router = express.Router();
router.get("/", authMiddleware, getCourses);

module.exports = router;