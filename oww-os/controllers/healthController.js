const systemService = require("../services/systemService");
const messageService = require("../services/messageService");

class HealthController {
  getHealth(req, res) {
    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      stats: {
        registeredSystems: systemService.getSystemsCount(),
        totalMessages: messageService.getMessageCount(),
      },
    };

    res.json(health);
  }
}

module.exports = new HealthController();
