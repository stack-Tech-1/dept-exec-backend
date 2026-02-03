// C:\Users\SMC\Documents\GitHub\dept-exec-backend\src\middleware\auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

// Main authentication middleware
exports.authenticate = async (req, res, next) => {
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

    // Attach user to request (include position from token)
    req.user = {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      position: user.position || decoded.position, // Include position
      department: user.department
    };
    
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

// Role-based authorization middleware
exports.authorize = (roles = []) => {
  if (typeof roles === 'string') {
    roles = [roles];
  }

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: "Authentication required." 
      });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        success: false,
        message: `Access denied. Required role: ${roles.join(' or ')}` 
      });
    }

    next();
  };
};

// Admin only middleware (alias for authorize(['ADMIN']))
exports.adminOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "ADMIN") {
    return res.status(403).json({ 
      success: false,
      message: "Access denied. Admin privileges required." 
    });
  }
  next();
};

// Executive only middleware
exports.execOnly = (req, res, next) => {
  if (!req.user || req.user.role !== "EXEC") {
    return res.status(403).json({ 
      success: false,
      message: "Access denied. Executive privileges required." 
    });
  }
  next();
};

// Check if user owns resource
exports.checkOwnership = (modelName, idParam = 'id') => {
  return async (req, res, next) => {
    try {
      const Model = require(`../models/${modelName}.model`);
      const resource = await Model.findById(req.params[idParam]);

      if (!resource) {
        return res.status(404).json({ 
          success: false,
          message: "Resource not found." 
        });
      }

      // Admins can access anything
      if (req.user.role === "ADMIN") {
        return next();
      }

      // Check if user owns the resource
      const ownerId = resource.createdBy?.toString() || resource.userId?.toString();
      if (ownerId !== req.user.id.toString()) {
        return res.status(403).json({ 
          success: false,
          message: "Access denied. You can only access your own resources." 
        });
      }

      next();
    } catch (error) {
      console.error("Ownership check error:", error);
      res.status(500).json({ 
        success: false,
        message: "Server error checking ownership." 
      });
    }
  };
};