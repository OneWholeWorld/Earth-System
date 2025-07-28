const prisma = require("../utils/prisma");
const { createLog } = require("./logService");

interface MatchResult {
  system: any;
  avatar?: any;
  score: number;
  reasons: string[];
}

interface AutoMappingResult {
  success: boolean;
  mapping?: any;
  message: string;
  suggestions?: MatchResult[];
}

const CAPABILITY_KEYWORDS = {
  robot: {
    cleaning: ["clean", "vacuum", "mop", "tidy"],
    serving: ["serve", "bring", "fetch", "deliver"],
    monitoring: ["monitor", "watch", "guard", "security"],
    assistance: ["help", "assist", "support"],
  },

  human: {
    teaching: [
      "teach",
      "educate",
      "learn",
      "study",
      "knowledge",
      "lesson",
      "instruction",
    ],
    driving: ["drive", "transport", "travel", "ride", "pickup", "drop"],
    cooking: ["cook", "food", "meal", "recipe", "kitchen", "prepare"],
    // cleaning: ["clean", "tidy", "organize", "wash", "maintain"],
    helping: ["help", "assist", "support", "aid"],
    childcare: ["child", "baby", "kid", "babysit", "care"],
    medical: ["doctor", "medical", "health", "medicine", "treatment"],
    repair: ["fix", "repair", "maintain", "service"],
  },

  car: {
    transport: [
      "transport",
      "drive",
      "travel",
      "ride",
      "pickup",
      "drop",
      "commute",
    ],
    delivery: ["deliver", "carry", "move", "transport goods"],
  },

  animal: {
    companionship: ["company", "companion", "friend", "comfort"],
    protection: ["guard", "protect", "security", "watch"],
    therapy: ["therapy", "emotional", "comfort", "calm"],
  },
};

const AVATAR_ROLE_KEYWORDS = {
  father: ["father", "dad", "parent", "family", "guidance", "support"],
  mother: ["mother", "mom", "parent", "family", "care", "nurture"],
  teacher: ["teach", "educate", "learn", "study", "knowledge", "lesson"],
  driver: ["drive", "transport", "travel", "ride"],
  doctor: ["medical", "health", "medicine", "treatment", "doctor"],
  chef: ["cook", "food", "meal", "recipe", "kitchen"],
  cleaner: ["clean", "tidy", "organize", "maintain"],
  guard: ["guard", "protect", "security", "watch", "safety"],
};

export const autoMapNeed = async (
  needId: string,
  threshold: number = 0.6
): Promise<AutoMappingResult> => {
  try {
    // get the need with full context
    const need = await prisma.need.findUnique({
      where: { id: needId },
      include: {
        goal: {
          include: {
            avatar: {
              include: { system: true },
            },
          },
        },
      },
    });

    console.log("Need", need);

    if (!need) {
      return {
        success: false,
        message: "Need not found",
      };
    }

    const existingMapping = await prisma.mapping.findFirst({
      where: { needId, status: { notIn: ["REJECTED", "CANCELED"] } },
    });

    if (existingMapping) {
      return {
        success: false,
        message: "Mapping already exists for this need",
      };
    }

    const systems = await prisma.system.findMany({
      include: { avatars: true },
    });

    console.log("systems", systems);

    // find matches
    const matches = await findMatches(need, systems);

    if (matches.length === 0) {
      return {
        success: false,
        message: "No suitable fulfiller found for this need",
        suggestions: [],
      };
    }

    // Get the best match
    const bestMatch = matches[0];

    console.log("bestMatch", bestMatch);

    // If confidence is high enough, create automatic mapping
    if (bestMatch.score >= threshold) {
      const mapping = await prisma.mapping.create({
        data: {
          needId,
          fulfillerSystemId: bestMatch.system.id,
          fulfillerAvatarId: bestMatch.avatar?.id,
          status: "PENDING",
          notes: `Auto-mapped with confidence ${(bestMatch.score * 100).toFixed(
            1
          )}%. Reasons: ${bestMatch.reasons.join(", ")}`,
        },
      });

      await createLog(
        "MAPPING_CREATED",
        `Auto-mapping created for Need: "${need.description}" matched with ${
          bestMatch.system.name
        }${bestMatch.avatar ? ` (${bestMatch.avatar.name})` : ""}`,
        mapping.id,
        {
          needId,
          fulfillerSystemId: bestMatch.system.id,
          fulfillerAvatarId: bestMatch.avatar?.id,
          autoMapped: true,
          confidence: bestMatch.score,
          reasons: bestMatch.reasons,
        }
      );

      return {
        success: true,
        mapping,
        message: `Successfully auto-mapped to ${bestMatch.system.name}${
          bestMatch.avatar ? ` (${bestMatch.avatar.name})` : ""
        } with ${(bestMatch.score * 100).toFixed(1)}% confidence`,
      };
    } else {
      return {
        success: false,
        message: `No high-confidence match found. Best match has ${(
          bestMatch.score * 100
        ).toFixed(1)}% confidence, which is below the ${
          threshold * 100
        }% threshold.`,
        suggestions: matches.slice(0, 3), // top 3 suggestions
      };
    }
  } catch (error: any) {
    return {
      success: false,
      message: `Error during auto-mapping: ${error.message}`,
    };
  }
};

/**
 * find and score potential matches for a need
 */
export const findMatches = async (
  need: any,
  systems: any[]
): Promise<MatchResult[]> => {
  const matches: MatchResult[] = [];
  const needText = need.description.toLowerCase();
  const goalText = need.goal.description.toLowerCase();
  const combinedText = `${needText} ${goalText}`;

  for (const system of systems) {
    // Skip the system that created the need (can't fulfill own needs)
    if (system.id === need.goal.avatar.systemId) {
      continue;
    }

    // Check system-level match
    const systemMatch = scoreSystemMatch(system, combinedText);
    if (systemMatch.score > 0) {
      matches.push(systemMatch);
    }

    // Check avatar-level matches
    for (const avatar of system.avatars) {
      const avatarMatch: any = scoreAvatarMatch(system, avatar, combinedText);
      if (avatarMatch.score > systemMatch.score) {
        matches.push(avatarMatch);
      }
    }
  }

  // Sort by score (highest first)
  return matches.sort((a, b) => b.score - a.score);
};

/**
 * Score how well a system matches a need
 */
export const scoreSystemMatch = (
  system: any,
  needText: string
): MatchResult => {
  let score = 0;
  const reasons: string[] = [];
  const systemType = system.type.toLowerCase();

  // Base score for system type relevance
  const capabilities =
    CAPABILITY_KEYWORDS[systemType as keyof typeof CAPABILITY_KEYWORDS];
  if (capabilities) {
    for (const [capability, keywords] of Object.entries(capabilities)) {
      const keywordMatches = keywords.filter((keyword) =>
        needText.includes(keyword)
      );
      if (keywordMatches.length > 0) {
        const capabilityScore = keywordMatches.length * 0.2;
        score += capabilityScore;
        reasons.push(
          `${systemType} can provide ${capability} (matched: ${keywordMatches.join(
            ", "
          )})`
        );
      }
    }
  }

  // Exact system name match
  if (needText.includes(system.name.toLowerCase())) {
    score += 0.3;
    reasons.push(`System name directly mentioned`);
  }

  // System type match
  if (needText.includes(systemType)) {
    score += 0.2;
    reasons.push(`System type (${systemType}) mentioned`);
  }

  return {
    system,
    score: Math.min(score, 1),
    reasons,
  };
};

/**
 * Score how well an avatar matches a need
 */
export const scoreAvatarMatch = async (
  system: any,
  avatar: any,
  needText: string
) => {
  const systemMatch = scoreSystemMatch(system, needText);
  let score = systemMatch.score;
  const reasons = [...systemMatch.reasons];

  const avatarName = avatar.name.toLowerCase();

  // Direct avatar name match
  if (needText.includes(avatarName)) {
    score += 0.4;
    reasons.push(`Avatar name (${avatarName}) directly mentioned`);
  }

  // Avatar role keyword match
  const roleKeywords =
    AVATAR_ROLE_KEYWORDS[avatarName as keyof typeof AVATAR_ROLE_KEYWORDS];
  if (roleKeywords) {
    const matchedKeywords = roleKeywords.filter((keyword) =>
      needText.includes(keyword)
    );
    if (matchedKeywords.length > 0) {
      score += matchedKeywords.length * 0.15;
      reasons.push(`Avatar role matches need (${matchedKeywords.join(", ")})`);
    }
  }

  return {
    system,
    avatar,
    score: Math.min(score, 1), // Cap at 1.0
    reasons,
  };
};

/**
 * Get mapping suggestions for a need without creating a mapping
 */
export const getSuggestions = async (
  needId: string
): Promise<MatchResult[]> => {
  const need = await prisma.need.findUnique({
    where: { id: needId },
    include: {
      goal: {
        include: {
          avatar: {
            include: { system: true },
          },
        },
      },
    },
  });

  if (!need) {
    return [];
  }

  const systems = await prisma.system.findMany({
    include: { avatars: true },
  });

  return findMatches(need, systems);
};

/**
 * Batch process multiple needs for auto-mapping
 */
export const batchAutoMap = async (
  needIds: string[],
  threshold: number = 0.6
): Promise<AutoMappingResult[]> => {
  const results: AutoMappingResult[] = [];

  for (const needId of needIds) {
    const result = await autoMapNeed(needId, threshold);
    results.push(result);
  }

  return results;
};

/**
 * Auto-map all pending needs
 */
export const autoMapPendingNeeds = async (
  threshold: number = 0.6
): Promise<{
  processed: number;
  successful: number;
  failed: number;
  results: AutoMappingResult[];
}> => {
  // Get all needs without mappings
  const needsWithoutMappings = await prisma.need.findMany({
    where: {
      mappings: {
        none: {
          status: {
            notIn: ["REJECTED", "CANCELED"],
          },
        },
      },
    },
    select: { id: true },
  });

  const needIds = needsWithoutMappings.map((need: any) => need.id);
  const results = await batchAutoMap(needIds, threshold);

  const successful = results.filter((r: any) => r.success).length;
  const failed = results.length - successful;

  return {
    processed: results.length,
    successful,
    failed,
    results,
  };
};

module.exports = {
  autoMapNeed,
  findMatches,
  scoreSystemMatch,
  scoreAvatarMatch,
  getSuggestions,
  batchAutoMap,
  autoMapPendingNeeds,
};
