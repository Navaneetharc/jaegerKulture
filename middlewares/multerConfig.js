// middlewares/multerConfig.js
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Ensure upload directory exists for userProfile images
const uploadDir = path.join(__dirname, '../public/uploads/userProfile');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `user-${timestamp}${ext}`);
  }
});

// File filters and limits
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png)$/i;
    if (!allowed.test(file.originalname)) {
      return cb(new Error('Only JPG, JPEG, and PNG files are allowed'), false);
    }
    cb(null, true);
  }
});

module.exports = upload;