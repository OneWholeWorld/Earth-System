const { v4: uuidv4 } = require("uuid");
const logger = require("../utils/logger");
const config = require("../config/config");

class SystemService {
  constructor() {
    this.registeredSystems = new Map();
    this.startCleanupTimer();
  }

  registerSystem(systemData) {
    const { systemId, name, port, capabilities } = systemData;

    if (!systemId || !name || !port) {
      throw new Error("Missing required fields: systemId, name, port");
    }

    const systemInfo = {
      systemId,
      name,
      port,
      capabilities: capabilities || [],
      registeredAt: new Date().toISOString(),
      lastHeartbeat: new Date().toISOString(),
      status: "active",
    };

    this.registeredSystems.set(systemId, systemInfo);
    logger.info(`System registered: ${name} (${systemId}) on port ${port}`);

    return systemInfo;
  }

  updateHeartbeat(systemId) {
    const system = this.registeredSystems.get(systemId);
    if (!system) {
      throw new Error("System not found");
    }

    system.lastHeartbeat = new Date().toISOString();
    system.status = "active";

    return system;
  }

  getSystem(systemId) {
    return this.registeredSystems.get(systemId);
  }

  getAllSystems() {
    return Array.from(this.registeredSystems.values());
  }

  removeSystem(systemId) {
    const removed = this.registeredSystems.delete(systemId);
    if (removed) {
      logger.info(`System removed: ${systemId}`);
    }
    return removed;
  }

  getSystemsCount() {
    return this.registeredSystems.size;
  }

  startCleanupTimer() {
    setInterval(() => {
      this.cleanupInactiveSystems();
    }, config.systemTimeout);
  }

  cleanupInactiveSystems() {
    const now = new Date();
    const timeoutThreshold = config.systemTimeout;

    for (const [systemId, system] of this.registeredSystems) {
      const lastHeartbeat = new Date(system.lastHeartbeat);
      const timeSinceHeartbeat = now - lastHeartbeat;

      if (timeSinceHeartbeat > timeoutThreshold) {
        system.status = "inactive";
        logger.warn(`System marked as inactive: ${system.name} (${systemId})`);
      }
    }
  }
}

module.exports = new SystemService();
