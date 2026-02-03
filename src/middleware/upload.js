// C:\Users\SMC\Documents\GitHub\dept-exec-backend\src\middleware\upload.js
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "..", "uploads", "minutes");
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `recording-${timestamp}-${uniqueSuffix}${ext}`);
  }
});

// File filter
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'video/mp4', 'video/mov', 'video/avi', 'video/wmv',
    'audio/mpeg', 'audio/wav', 'audio/mp3'
  ];
  
  const maxSize = 100 * 1024 * 1024; // 100MB

  if (!allowedTypes.includes(file.mimetype)) {
    return cb(new Error('Invalid file type. Only video/audio files are allowed.'), false);
  }

  if (file.size > maxSize) {
    return cb(new Error('File size too large. Maximum size is 100MB.'), false);
  }

  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
});

module.exports = upload;