const logger = require("../utils/logger");

const errorHandler = (err, req, res, next) => {
  logger.error(err.message, err);

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
  });
};

module.exports = {
  errorHandler,
  notFoundHandler,
};
