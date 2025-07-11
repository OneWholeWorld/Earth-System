const systemService = require("../services/systemService");
const logger = require("../utils/logger");

class SystemController {
  async registerSystem(req, res, next) {
    try {
      const systemInfo = systemService.registerSystem(req.body);
      res.status(201).json({
        success: true,
        message: "System registered successfully",
        systemInfo,
      });
    } catch (error) {
      next(error);
    }
  }

  async updateHeartbeat(req, res, next) {
    try {
      const { systemId } = req.body;
      const system = systemService.updateHeartbeat(systemId);
      res.json({
        success: true,
        timestamp: system.lastHeartbeat,
      });
    } catch (error) {
      next(error);
    }
  }

  async getAllSystems(req, res, next) {
    try {
      const systems = systemService.getAllSystems();
      res.json({
        success: true,
        systems,
        total: systems.length,
      });
    } catch (error) {
      next(error);
    }
  }

  async getSystem(req, res, next) {
    try {
      const { systemId } = req.params;
      const system = systemService.getSystem(systemId);

      if (!system) {
        return res.status(404).json({
          success: false,
          error: "System not found",
        });
      }

      res.json({
        success: true,
        system,
      });
    } catch (error) {
      next(error);
    }
  }

  async removeSystem(req, res, next) {
    try {
      const { systemId } = req.params;
      const removed = systemService.removeSystem(systemId);

      if (!removed) {
        return res.status(404).json({
          success: false,
          error: "System not found",
        });
      }

      res.json({
        success: true,
        message: "System removed successfully",
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SystemController();
