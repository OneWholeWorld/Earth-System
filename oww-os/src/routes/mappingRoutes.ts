import express from "express";
const mappingController = require("../controllers/mappingController");
const router = express.Router();

/**
 * Auto-map a single need
 * Body: { needId: string, threshold?: number }
 */
router.post("/auto-map", mappingController.autoMapNeed);

/**
 * Get mapping suggestions for a need
 * No body required
 */
router.get("/suggestions/:needId", mappingController.getMappingSuggestions);

/**
 * Batch auto-map multiple needs
 * Body: { needIds: string[], threshold?: number }
 */
router.post("/batch-auto-map", mappingController.batchAutoMap);

/**
 * Auto-map all pending needs (needs without any active mappings)
 * Body: { threshold?: number }
 */
router.post("/auto-map-pending", mappingController.autoMapPendingNeeds);

/**
 * Create mapping from a suggestion (manual selection after viewing suggestions)
 * Body: { needId: string, fulfillerSystemId: string, fulfillerAvatarId?: string, notes?: string }
 */
router.post("/from-suggestion", mappingController.createMappingFromSuggestion);

module.exports = router;
