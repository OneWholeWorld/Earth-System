// const mappingService = require("../services/mappingService");
// const AutomatedMappingService = require("../services/mappingService");
const AutomatedMappingService = require("../services/mappingService");

/**
 * Auto-map a single need
 * POST /api/mappings/auto-map
 */
const autoMapNeed = async (req: any, res: any) => {
  try {
    const { needId, threshold = 0.6 } = req.body;

    if (!needId) {
      return res.status(400).json({ error: "needId is required" });
    }

    const result = await AutomatedMappingService.autoMapNeed(needId, threshold);

    if (result.success) {
      res.status(201).json({
        success: true,
        message: result.message,
        mapping: result.mapping,
      });
    } else {
      res.status(200).json({
        success: false,
        message: result.message,
        suggestions: result.suggestions || [],
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get mapping suggestions for a need without creating a mapping
 * GET /api/mappings/suggestions/:needId
 */
const getMappingSuggestions = async (req: any, res: any) => {
  try {
    const { needId } = req.params;
    const suggestions = await AutomatedMappingService.getSuggestions(needId);

    res.status(200).json({
      needId,
      suggestions: suggestions.map((suggestion: any) => ({
        system: {
          id: suggestion.system.id,
          name: suggestion.system.name,
          type: suggestion.system.type,
        },
        avatar: suggestion.avatar
          ? {
              id: suggestion.avatar.id,
              name: suggestion.avatar.name,
            }
          : null,
        confidence: Math.round(suggestion.score * 100),
        reasons: suggestion.reasons,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Batch auto-map multiple needs
 * POST /api/mappings/batch-auto-map
 */
const batchAutoMap = async (req: any, res: any) => {
  try {
    const { needIds, threshold = 0.6 } = req.body;

    if (!needIds || !Array.isArray(needIds)) {
      return res.status(400).json({ error: "needIds array is required" });
    }

    const results = await AutomatedMappingService.batchAutoMap(
      needIds,
      threshold
    );

    const successful = results.filter((r: any) => r.success);
    const failed = results.filter((r: any) => !r.success);

    res.status(200).json({
      summary: {
        total: results.length,
        successful: successful.length,
        failed: failed.length,
      },
      results: results.map((result: any) => ({
        success: result.success,
        message: result.message,
        mapping: result.mapping || null,
        suggestions: result.suggestions || [],
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Auto-map all pending needs
 * POST /api/mappings/auto-map-pending
 */
const autoMapPendingNeeds = async (req: any, res: any) => {
  try {
    const { threshold = 0.6 } = req.body;

    const result = await AutomatedMappingService.autoMapPendingNeeds(threshold);

    res.status(200).json({
      summary: {
        processed: result.processed,
        successful: result.successful,
        failed: result.failed,
        successRate:
          result.processed > 0
            ? Math.round((result.successful / result.processed) * 100)
            : 0,
      },
      details: result.results.map((r: any) => ({
        success: r.success,
        message: r.message,
        mapping: r.mapping || null,
        suggestions: r.suggestions || [],
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Create mapping from suggestion
 * POST /api/mappings/from-suggestion
 */
const createMappingFromSuggestion = async (req: any, res: any) => {
  try {
    const { needId, fulfillerSystemId, fulfillerAvatarId, notes } = req.body;

    if (!needId || !fulfillerSystemId) {
      return res.status(400).json({
        error: "needId and fulfillerSystemId are required",
      });
    }

    // Get the suggestion details for logging
    const suggestions = await AutomatedMappingService.getSuggestions(needId);
    const selectedSuggestion = suggestions.find(
      (s: any) =>
        s.system.id === fulfillerSystemId &&
        (!fulfillerAvatarId || s.avatar?.id === fulfillerAvatarId)
    );

    const finalNotes = selectedSuggestion
      ? `Manual selection from suggestion with ${Math.round(
          selectedSuggestion.score * 100
        )}% confidence. ${notes || ""}`
      : notes;

    const mapping = await AutomatedMappingService.createMapping(
      needId,
      fulfillerSystemId,
      fulfillerAvatarId,
      finalNotes
    );

    res.status(201).json({
      mapping,
      selectedSuggestion: selectedSuggestion
        ? {
            confidence: Math.round(selectedSuggestion.score * 100),
            reasons: selectedSuggestion.reasons,
          }
        : null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  autoMapNeed,
  getMappingSuggestions,
  batchAutoMap,
  autoMapPendingNeeds,
  createMappingFromSuggestion,
};
