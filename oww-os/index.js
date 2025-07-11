const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const config = require("./config/config");
const routes = require("./routes");
const { errorHandler, notFoundHandler } = require("./middlewares/errorHandler");
const logger = require("./utils/logger");

const app = express();

// Middleware
app.use(cors());
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api", routes);

// Dashboard route
app.get("/", require("./controllers/dashboardController").getDashboard);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`🌍 One Whole World Operating System running on port ${PORT}`);
  logger.info(`📊 Dashboard available at: http://localhost:${PORT}`);
  logger.info(`🔧 API ready for system registration and communication`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  logger.info("🛑 Shutting down One Whole World Operating System...");
  process.exit(0);
});

module.exports = app;
