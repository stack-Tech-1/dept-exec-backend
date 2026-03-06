//C:\Users\SMC\Documents\GitHub\dept-exec-backend\src\server.js
require('dotenv').config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose");

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
const allowedOrigins = [
  'http://localhost:3000',
  'https://dept-exec-app.vercel.app',
  'https://www.ipeexecs.page',
  process.env.FRONTEND_URL,
].filter(Boolean).map(o => o.trim());

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn(`CORS blocked origin: ${origin}`);
    return callback(new Error(`CORS policy: origin ${origin} not allowed`));
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Add this for preflight requests
app.options('*', cors(corsOptions));

// Request logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

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
const meetingRoutes = require("./routes/meeting.routes");
const reportRoutes = require("./routes/report.routes");
const goalRoutes = require("./routes/goal.routes");
const searchRoutes = require("./routes/search.routes");
const memberRoutes = require("./routes/member.routes");
const announcementRoutes = require("./routes/announcement.routes");
const eventRoutes = require("./routes/event.routes");

// Import middleware
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

// Database connection
const connectDB = require("./config/db");
const { startOverdueChecker } = require("./utils/overdueChecker");

// ✅ SECURITY: Create uploads directory if it doesn't exist
if (process.env.NODE_ENV !== 'production') {
  const uploadsDir = path.join(__dirname, "uploads", "minutes");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log(`✅ Created uploads directory: ${uploadsDir}`);
  }
}

// Serve static files (uploaded recordings) — only when the directory exists
const uploadsPath = path.join(__dirname, "uploads");
if (fs.existsSync(uploadsPath)) {
  app.use("/uploads", express.static(uploadsPath, {
    setHeaders: (res) => {
      res.set("X-Content-Type-Options", "nosniff");
      res.set("Content-Disposition", "attachment");
    }
  }));
}


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
app.use("/api/meetings", meetingRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/members", memberRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/events", eventRoutes);

const PORT = process.env.PORT || 5000;

// Connect to MongoDB and start server
connectDB().then(() => {
  console.log("✅ Database connected successfully");
  
  const { initializeSocket } = require('./socket');

  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode`);
    console.log(`📍 Port: ${PORT}`);
    console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL}`);
    console.log(`📁 Uploads directory: ${path.join(__dirname, "uploads")}`);

    // Initialize Socket.io
    initializeSocket(server, corsOptions);
    console.log('🔌 Socket.io initialized');

    // Start background services
    startOverdueChecker();
    console.log("⏰ Overdue task checker started");
  });

  // 404 and error handlers — registered after all routes
  app.use(notFoundHandler);
  app.use(errorHandler);

  // Graceful shutdown
  const shutdown = (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    server.close(() => {
      console.log('HTTP server closed');
      mongoose.connection.close().then(() => {
        console.log('Database connection closed');
        process.exit(0);
      });
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

}).catch(error => {
  console.error("❌ Failed to connect to database:", error);
  process.exit(1);
});