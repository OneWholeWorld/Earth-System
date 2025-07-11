module.exports = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || "development",
  heartbeatTimeout: 60000,
  messageRetentionPeriod: 24 * 60 * 60 * 1000,
  maxPendingMessages: 1000,
  systemTimeout: 120000,
  logLevel: process.env.LOG_LEVEL || "info",
};
