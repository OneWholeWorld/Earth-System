const express = require("express");
const messageController = require("../controllers/messageController");
const { validateMessage } = require("../middlewares/validation");

const router = express.Router();

router.post("/send", validateMessage, messageController.sendMessage);
router.get("/:systemId", messageController.getMessages);
router.post("/acknowledge", messageController.acknowledgeMessage);
router.get("/logs", messageController.getMessageLogs);

module.exports = router;
