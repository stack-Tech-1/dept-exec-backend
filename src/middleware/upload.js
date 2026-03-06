// Re-export from cloudinary config for backward compatibility
// minutes.routes.js uses: const upload = require('../middleware/upload')
const { uploadMinutesFile } = require('../config/cloudinary');
module.exports = uploadMinutesFile;
