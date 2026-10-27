/**
 * Secure File Upload Middleware
 * Enforces strict MIME validation, file extension validation, size limits (5MB),
 * cryptographically random file naming, and path traversal protection.
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const ALLOWED_MIME_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/jpg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const createSecureUploader = (subfolder = '') => {
  const uploadsBase = path.resolve(__dirname, '..', 'uploads');
  const targetDir = path.resolve(uploadsBase, subfolder);

  // Ensure target folder exists and remains within uploads directory (path traversal check)
  if (!targetDir.startsWith(uploadsBase)) {
    throw new Error('Invalid upload directory path: path traversal detected');
  }
  fs.mkdirSync(targetDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, targetDir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : (ALLOWED_MIME_TYPES.get(file.mimetype) || '.jpg');
      const uniqueSuffix = crypto.randomUUID();
      cb(null, `${uniqueSuffix}${safeExt}`);
    },
  });

  const fileFilter = (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const isMimeAllowed = ALLOWED_MIME_TYPES.has(file.mimetype);
    const isExtAllowed = ALLOWED_EXTENSIONS.has(ext);

    if (isMimeAllowed && isExtAllowed) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, JPEG, PNG, and WebP image files are allowed.'));
    }
  };

  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: MAX_FILE_SIZE,
      files: 1,
    },
  });
};

/**
 * Verifies magic bytes (file signature) of the uploaded file on disk.
 * Supported signatures:
 * - JPEG: FF D8 FF
 * - PNG: 89 50 4E 47
 * - WebP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
 */
const verifyFileSignature = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) return false;
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(12);
    const bytesRead = fs.readSync(fd, buffer, 0, 12, 0);
    fs.closeSync(fd);

    if (bytesRead < 4) return false;

    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }
    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return 'image/png';
    }
    // WebP: RIFF at 0, WEBP at 8
    if (
      bytesRead >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
    ) {
      return 'image/webp';
    }

    return false;
  } catch (err) {
    return false;
  }
};

const verifyUploadedFileSignature = (req, res, next) => {
  const file = req.file;
  if (!file) return next();

  const isSignatureValid = verifyFileSignature(file.path);
  if (!isSignatureValid) {
    try {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (_) {}
    return res.status(400).json({
      success: false,
      message: 'Invalid file content: magic byte verification failed. The uploaded file is not a genuine image.',
    });
  }

  next();
};

module.exports = {
  createSecureUploader,
  verifyFileSignature,
  verifyUploadedFileSignature,
  MAX_FILE_SIZE,
  ALLOWED_EXTENSIONS,
  ALLOWED_MIME_TYPES,
};
