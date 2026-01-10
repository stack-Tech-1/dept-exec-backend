const multer = require("multer");
const path = require("path");
const fs = require("fs");

// ✅ ONLY create directory if we are NOT on Vercel
const uploadDir = "src/uploads/minutes";
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
}

// ✅ Use Memory Storage for Vercel, Disk Storage for Local Dev
const storage = process.env.VERCEL 
  ? multer.memoryStorage() 
  : multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
        const uniqueName = `${Date.now()}-${safeName}`;
        cb(null, uniqueName);
      },
    });

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'video/mp4', 'video/mov', 'video/avi', 'video/webm',
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg',
    'application/pdf'
  ];
  
  if (!allowedMimeTypes.includes(file.mimetype)) {
    const error = new Error(`Invalid file type.`);
    error.statusCode = 400;
    return cb(error, false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024, files: 1 },
  fileFilter,
});

module.exports = upload;