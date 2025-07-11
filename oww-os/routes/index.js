const express = require("express");
const systemRoutes = require("./systemRoutes");
// const messageRoutes = require("./messageRoutes");
const messageRoutes = require("./messageRoutes");
const healthRoutes = require("./healthRoutes");

const router = express.Router();

router.use("/systems", systemRoutes);
router.use("/messages", messageRoutes);
router.use("/health", healthRoutes);

module.exports = router;
