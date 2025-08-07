import express from "express";
const goalController = require("../controllers/goalController");
const router = express.Router();

router.post("/", goalController.createGoal);
router.get("/", goalController.getAllGoal);
router.get("/:id", goalController.getGoal);
router.get("/avatar/:avatarId", goalController.getGoalsForAvatar);
router.patch("/:id/status", goalController.updateGoalStatus);

module.exports = router;
