const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/auth');
const { verifyUploadedFileSignature } = require('../middleware/fileUpload');
const { profileImageUpload } = require('../config/profileUpload');
const {
  getUserProfile,
  updateUserProfile,
  uploadProfileImage,
} = require('../controllers/userController');

const handleProfileImageUpload = (req, res, next) => {
  profileImageUpload.single('profileImage')(req, res, (error) => {
    if (error) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'Image size must be 5MB or less' });
      }

      return res.status(400).json({ success: false, message: error.message });
    }

    next();
  });
};

router.get('/', protect, getUserProfile);
router.put('/', protect, updateUserProfile);
router.post('/upload-image', protect, handleProfileImageUpload, verifyUploadedFileSignature, uploadProfileImage);

module.exports = router;