// C:\Users\SMC\Documents\GitHub\dept-exec-backend\src\routes\search.routes.js
const express = require("express");
const router = express.Router();
const searchController = require("../controllers/search.controller");
const { authenticate } = require("../middleware/auth.middleware");

router.use(authenticate);

router.get("/", searchController.globalSearch);

module.exports = router;