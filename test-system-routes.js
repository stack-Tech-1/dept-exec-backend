// test-system-routes.js
require('dotenv').config();
const express = require("express");
const app = express();

app.use(express.json());

// Load your actual system routes
const systemRoutes = require("./src/routes/system.routes");
app.use("/api/system", systemRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

const PORT = 5002;
app.listen(PORT, () => {
  console.log(`Testing system routes on port ${PORT}`);
});