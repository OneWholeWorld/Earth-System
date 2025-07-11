const { v4: uuidv4 } = require("uuid");
const logger = require("../utils/logger");
const config = require("../config/config");

class MessageService {
  constructor() {
    this.messageLog = [];
    this.pendingMessages = new Map();
    this.startCleanupTimer();
  }

  sendMessage(messageData) {
    const { fromSystemId, toSystemId, messageType, payload, correlationId } =
      messageData;

    if (!fromSystemId || !toSystemId || !messageType || !payload) {
      throw new Error(
        "Missing required fields: fromSystemId, toSystemId, messageType, payload"
      );
    }

    const messageId = uuidv4();
    const message = {
      messageId,
      fromSystemId,
      toSystemId,
      messageType,
      payload,
      correlationId: correlationId || messageId,
      timestamp: new Date().toISOString(),
      status: "sent",
    };

    this.messageLog.push(message);

    if (!this.pendingMessages.has(toSystemId)) {
      this.pendingMessages.set(toSystemId, []);
    }

    const pending = this.pendingMessages.get(toSystemId);
    if (pending.length >= config.maxPendingMessages) {
      throw new Error(`Message queue full for system: ${toSystemId}`);
    }

    pending.push(message);
    logger.info(
      `Message queued: ${fromSystemId} → ${toSystemId} (${messageType})`
    );

    return message;
  }

  getMessages(systemId) {
    const messages = this.pendingMessages.get(systemId) || [];
    this.pendingMessages.set(systemId, []);
    return messages;
  }

  acknowledgeMessage(messageId, systemId, status = "delivered") {
    const messageIndex = this.messageLog.findIndex(
      (msg) => msg.messageId === messageId
    );
    if (messageIndex !== -1) {
      this.messageLog[messageIndex].status = status;
      this.messageLog[messageIndex].acknowledgedAt = new Date().toISOString();
      logger.info(`Message acknowledged: ${messageId} (${status})`);
      return true;
    }
    return false;
  }

  getMessageLogs(filters = {}) {
    const { fromSystemId, toSystemId, limit = 100 } = filters;

    let filteredLogs = this.messageLog;

    if (fromSystemId) {
      filteredLogs = filteredLogs.filter(
        (log) => log.fromSystemId === fromSystemId
      );
    }

    if (toSystemId) {
      filteredLogs = filteredLogs.filter(
        (log) => log.toSystemId === toSystemId
      );
    }

    return filteredLogs
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, parseInt(limit));
  }

  getMessageCount() {
    return this.messageLog.length;
  }

  getPendingMessageCount(systemId) {
    return (this.pendingMessages.get(systemId) || []).length;
  }

  startCleanupTimer() {
    setInterval(() => {
      this.cleanupOldMessages();
    }, config.messageRetentionPeriod);
  }

  cleanupOldMessages() {
    const now = new Date();
    const retentionThreshold = config.messageRetentionPeriod;

    this.messageLog = this.messageLog.filter((message) => {
      const messageTime = new Date(message.timestamp);
      return now - messageTime < retentionThreshold;
    });

    logger.info(
      `Cleaned up old messages. Current count: ${this.messageLog.length}`
    );
  }
}

module.exports = new MessageService();
