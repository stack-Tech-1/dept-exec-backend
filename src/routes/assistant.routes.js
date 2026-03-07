const express = require('express');
const router = express.Router();
const assistantController = require('../controllers/assistant.controller');
const { authenticate } = require('../middleware/auth.middleware');

router.use(authenticate);
router.post('/chat', assistantController.chat);
router.get('/suggestions', assistantController.getSuggestions);

module.exports = router;
