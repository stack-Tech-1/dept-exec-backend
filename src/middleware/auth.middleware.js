const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

exports.protect = async (req, res, next) => {
  try {
    // Get token from header
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({ 
        success: false,
        message: "Not authorized. No token provided." 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user still exists and is active
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: "User no longer exists. Token invalid." 
      });
    }

    if (!user.isActive) {
      return res.status(401).json({ 
        success: false,
        message: "User account is deactivated." 
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    
    let message = "Invalid token";
    let status = 401;
    
    if (error.name === "TokenExpiredError") {
      message = "Token expired. Please login again.";
      status = 401;
    } else if (error.name === "JsonWebTokenError") {
      message = "Invalid token. Please login again.";
      status = 401;
    }
    
    res.status(status).json({ 
      success: false,
      message 
    });
  }
};

exports.adminOnly = (req, res, next) => {
  if (req.user.role !== "ADMIN") {
    return res.status(403).json({ 
      success: false,
      message: "Access denied. Admin privileges required." 
    });
  }
  next();
};