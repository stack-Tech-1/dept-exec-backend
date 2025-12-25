const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Create uploads directory if it doesn't exist
const uploadDir = "src/uploads/minutes";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename: remove special characters, keep only safe ones
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueName = `${Date.now()}-${safeName}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  // Only allow specific file types
  const allowedMimeTypes = [
    'video/mp4', 'video/mov', 'video/avi', 'video/webm',
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg',
    'application/pdf'
  ];
  
  if (!allowedMimeTypes.includes(file.mimetype)) {
    const error = new Error(
      `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`
    );
    error.statusCode = 400;
    return cb(error, false);
  }
  
  cb(null, true);
};

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 1, // Only one file per request
  },
  fileFilter,
});

module.exports = upload;