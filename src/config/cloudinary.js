const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage for task attachments
const taskStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: 'iesa/tasks',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx', 'xls', 'xlsx'],
    resource_type: 'auto',
    public_id: `task-${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`,
  }),
});

// Storage for minutes recordings
const minutesStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: 'iesa/minutes',
    resource_type: 'auto',
    public_id: `minutes-${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`,
  }),
});

const uploadTaskFile = multer({
  storage: taskStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const uploadMinutesFile = multer({
  storage: minutesStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB for recordings
});

module.exports = { cloudinary, uploadTaskFile, uploadMinutesFile };
