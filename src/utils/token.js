const crypto = require("crypto");

exports.generateToken = () =>
  crypto.randomBytes(32).toString("hex");