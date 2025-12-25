exports.errorHandler = (err, req, res, next) => {
    console.error(`❌ ${req.method} ${req.url}:`, err);
  
    const status = err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    // Log full error in development
    if (process.env.NODE_ENV === "development") {
      console.error("Stack:", err.stack);
    }
  
    res.status(status).json({
      success: false,
      message: process.env.NODE_ENV === "production"
        ? "An unexpected error occurred. Please try again later."
        : message,
      ...(process.env.NODE_ENV === "development" && { 
        stack: err.stack,
        path: req.path 
      })
    });
  };
  
  // Handle 404 Not Found
  exports.notFoundHandler = (req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    error.statusCode = 404;
    next(error);
  };