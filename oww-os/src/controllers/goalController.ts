const goalService = require("../services/goalService");

const createGoal = async (req: any, res: any) => {
  try {
    const { avatarId, description } = req.body;
    const goal = await goalService.createGoal(avatarId, description);
    res.status(201).json(goal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const getAllGoal = async (req: any, res: any) => {
  try {
    const goal = await goalService.getAllGoals();
    if (!goal) {
      return res.status(404).json({ message: "Goal not found" });
    }
    res.status(200).json(goal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const getGoal = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const goal = await goalService.getGoalById(id);
    if (!goal) {
      return res.status(404).json({ message: "Goal not found" });
    }
    res.status(200).json(goal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const getGoalsForAvatar = async (req: any, res: any) => {
  try {
    const { avatarId } = req.params;
    const goals = await goalService.getGoalsByAvatarId(avatarId);
    res.status(200).json(goals);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const updateGoalStatus = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const updatedGoal = await goalService.updateGoalStatus(id, status);
    res.status(200).json(updatedGoal);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createGoal,
  getAllGoal,
  getGoal,
  getGoalsForAvatar,
  updateGoalStatus,
};
