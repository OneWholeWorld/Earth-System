import express from "express";
const needController = require("../controllers/needController");
const router = express.Router();

router.post("/", needController.createNeed);
router.get("/", needController.getAllNeed);
router.get("/:id", needController.getNeed);
router.get("/goal/:goalId", needController.getNeedsForGoal);

module.exports = router;
