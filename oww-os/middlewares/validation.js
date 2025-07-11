const { body, param, query, validationResult } = require("express-validator");

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      details: errors.array(),
    });
  }
  next();
};

const validateSystemRegistration = [
  body("systemId").notEmpty().withMessage("System ID is required"),
  body("name").notEmpty().withMessage("System name is required"),
  body("port")
    .isInt({ min: 1, max: 65535 })
    .withMessage("Valid port number is required"),
  body("capabilities")
    .optional()
    .isArray()
    .withMessage("Capabilities must be an array"),
  handleValidationErrors,
];

const validateMessage = [
  body("fromSystemId").notEmpty().withMessage("From system ID is required"),
  body("toSystemId").notEmpty().withMessage("To system ID is required"),
  body("messageType").notEmpty().withMessage("Message type is required"),
  body("payload").notEmpty().withMessage("Payload is required"),
  handleValidationErrors,
];

const validateHeartbeat = [
  body("systemId").notEmpty().withMessage("System ID is required"),
  handleValidationErrors,
];

module.exports = {
  validateSystemRegistration,
  validateMessage,
  validateHeartbeat,
  handleValidationErrors,
};
