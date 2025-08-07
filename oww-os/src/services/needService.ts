const prisma = require("../utils/prisma");
const { createLog } = require("./logService");

export const createNeed = async (goalId: any, description: any) => {
  const need = await prisma.need.create({
    data: {
      goalId,
      description,
    },
  });
  await createLog(
    "NEED_CREATED",
    `Need "${description}" created for Goal ID: ${goalId} with ID: ${need.id}`,
    need.id,
    { goalId }
  );
  return need;
};

const getAllNeeds = async () => {
  return await prisma.need.findMany({
    include: {
      goal: true,
      mappings: { include: { fulfillerSystem: true, fulfillerAvatar: true } },
    },
  });
};

const getNeedById = async (id: any) => {
  return await prisma.need.findUnique({
    where: { id },
    include: {
      goal: true,
      mappings: { include: { fulfillerSystem: true, fulfillerAvatar: true } },
    },
  });
};

const getNeedsByGoalId = async (goalId: any) => {
  return await prisma.need.findMany({
    where: { goalId },
    include: {
      mappings: { include: { fulfillerSystem: true, fulfillerAvatar: true } },
    },
  });
};

module.exports = {
  createNeed,
  getAllNeeds,
  getNeedById,
  getNeedsByGoalId,
};
