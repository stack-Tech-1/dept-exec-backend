require('dotenv').config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

const app = express();
app.set('trust proxy', 1);

// ✅ SECURITY: Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
  crossOriginResourcePolicy: { policy: "same-site" }
}));

// ✅ FIXED: CORS Configuration
const corsOptions = {
  origin: [
    'http://localhost:3000', // Local development
    'https://dept-exec-app.onrender.com', // Your frontend URL
    process.env.FRONTEND_URL // From environment variable
  ].filter(Boolean), // Remove any undefined values
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Add this for preflight requests
app.options('*', cors(corsOptions));

// ✅ FIXED: Handle preflight for API routes only (not wildcard)
//app.options('/api/*', cors(corsOptions));

// ✅ SECURITY: JSON body parsing with size limit
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// ✅ SECURITY: Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: {
    success: false,
    message: "Too many requests. Please try again later."
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: process.env.NODE_ENV === 'development',
});
app.use("/api", limiter);

// Import routes
const authRoutes = require("./routes/auth.routes");
const taskRoutes = require("./routes/task.routes");
const systemRoutes = require("./routes/system.routes");
const notificationRoutes = require("./routes/notification.routes");
const minutesRoutes = require("./routes/minutes.routes");
const userRoutes = require("./routes/user.routes");

// Import middleware
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

// Database connection
const connectDB = require("./config/db");
const startOverdueChecker = require("./utils/overdueChecker");

// ✅ SECURITY: Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, "uploads", "minutes");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`✅ Created uploads directory: ${uploadsDir}`);
}

// Serve static files (uploaded recordings)
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  setHeaders: (res, path) => {
    // Security headers for static files
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Content-Disposition", "attachment"); // Force download for security
  }
}));


// ✅ FIXED: Root Route to stop Render's 404 logs
app.get("/", (req, res) => {
  res.status(200).send("IPE Department Executive API is Live 🚀");
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/system", systemRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/minutes", minutesRoutes);
app.use("/api/users", userRoutes);



// ✅ SECURITY: 404 Handler (must be before errorHandler)
app.use(notFoundHandler);

// ✅ SECURITY: Global error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Connect to MongoDB and start server
connectDB().then(() => {
  console.log("✅ Database connected successfully");
  
  app.listen(PORT, () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL }`);
    console.log(`📁 Uploads directory: ${path.join(__dirname, "uploads")}`);

    // Start background services
    startOverdueChecker();
    console.log("⏰ Overdue task checker started");
  });
}).catch(error => {
  console.error("❌ Failed to connect to database:", error);
  process.exit(1);
});