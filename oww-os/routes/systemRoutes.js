const express = require("express");
const systemController = require("../controllers/systemController");
const {
  validateSystemRegistration,
  validateHeartbeat,
} = require("../middlewares/validation");

const router = express.Router();

router.post(
  "/register",
  validateSystemRegistration,
  systemController.registerSystem
);
router.post("/heartbeat", validateHeartbeat, systemController.updateHeartbeat);
router.get("/", systemController.getAllSystems);
router.get("/:systemId", systemController.getSystem);
router.delete("/:systemId", systemController.removeSystem);

module.exports = router;
