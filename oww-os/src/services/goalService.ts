const prisma = require("../utils/prisma");
const { createLog } = require("./logService");

export const createGoal = async (avatarId: any, description: any) => {
  const goal = await prisma.goal.create({
    data: {
      avatarId,
      description,
    },
  });
  await createLog(
    "GOAL_CREATED",
    `Goal "${description}" created for Avatar ID: ${avatarId} with ID: ${goal.id}`,
    goal.id,
    { avatarId }
  );
  return goal;
};

const getAllGoals = async () => {
  return await prisma.goal.findMany({
    include: { avatar: true, needs: true },
  });
};

const getGoalById = async (id: any) => {
  return await prisma.goal.findUnique({
    where: { id },
    include: { avatar: true, needs: true },
  });
};

const getGoalsByAvatarId = async (avatarId: any) => {
  return await prisma.goal.findMany({
    where: { avatarId },
    include: { needs: true },
  });
};

const updateGoalStatus = async (id: any, status: any) => {
  const goal = await prisma.goal.update({
    where: { id },
    data: { status },
  });
  await createLog(
    "GOAL_STATUS_UPDATED",
    `Goal ID: ${id} status updated to: ${status}`,
    goal.id,
    { newStatus: status }
  );
  return goal;
};

module.exports = {
  createGoal,
  getGoalById,
  getAllGoals,
  getGoalsByAvatarId,
  updateGoalStatus,
};
