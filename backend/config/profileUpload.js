const fs = require('fs');
const path = require('path');
const multer = require('multer');

const profileImagesDir = path.join(__dirname, '..', 'uploads', 'profile-images');

fs.mkdirSync(profileImagesDir, { recursive: true });

const allowedMimeTypes = new Map([
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, profileImagesDir);
  },
  filename: (req, file, cb) => {
    const fileExtension = allowedMimeTypes.get(file.mimetype) || '.jpg';
    const rolePrefix = req.user?.role === 'admin' ? 'admin' : 'student';
    const fileName = `${rolePrefix}-${req.user.id}${fileExtension}`;
    cb(null, fileName);
  },
});

const fileFilter = (req, file, cb) => {
  if (!allowedMimeTypes.has(file.mimetype)) {
    cb(new Error('Only JPG, JPEG, and PNG image files are allowed'));
    return;
  }

  cb(null, true);
};

const profileImageUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

module.exports = {
  profileImageUpload,
  profileImagesDir,
};