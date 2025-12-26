// minimal-server.js
require('dotenv').config();
const express = require("express");
const app = express();

app.use(express.json());

// Test with minimal system routes
const testRouter = require('express').Router();

testRouter.get('/test', (req, res) => {
  console.log('Test route called');
  res.json({ message: 'Test successful' });
});

app.use("/api/system", testRouter);

app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Minimal server running on port ${PORT}`);
});