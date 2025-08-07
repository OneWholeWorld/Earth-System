const needService = require("../services/needService");

const createNeed = async (req: any, res: any) => {
  try {
    const { goalId, description } = req.body;
    const need = await needService.createNeed(goalId, description);
    res.status(201).json(need);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const getAllNeed = async (req: any, res: any) => {
  try {
    const need = await needService.getAllNeeds();
    if (!need) {
      return res.status(404).json({ message: "Need not found" });
    }
    res.status(200).json(need);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const getNeed = async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const need = await needService.getNeedById(id);
    if (!need) {
      return res.status(404).json({ message: "Need not found" });
    }
    res.status(200).json(need);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

const getNeedsForGoal = async (req: any, res: any) => {
  try {
    const { goalId } = req.params;
    const needs = await needService.getNeedsByGoalId(goalId);
    res.status(200).json(needs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createNeed,
  getAllNeed,
  getNeed,
  getNeedsForGoal,
};
