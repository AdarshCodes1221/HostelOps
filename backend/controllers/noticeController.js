const Notice = require('../models/Notice');
const path = require('path');
const fs = require('fs');

// @desc    Get all notices
// @route   GET /api/notices
// @access  Public (all authenticated users)
exports.getAllNotices = async (req, res) => {
  try {
    const notices = await Notice.find()
      .populate('uploadedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });
    
    res.status(200).json({
      success: true,
      count: notices.length,
      data: notices
    });
  } catch (error) {
    console.error('Error fetching notices:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notices'
    });
  }
};

// @desc    Create notice with image upload
// @route   POST /api/notices
// @access  Admin only
exports.createNotice = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Image file is required'
      });
    }

    const { title, description } = req.body;
    const filePath = path.join('uploads', 'notices', req.file.filename);
    const imageUrl = `${req.protocol}://${req.get('host')}/${filePath.replaceAll('\\', '/')}`;

    const notice = await Notice.create({
      title: title || null,
      description: description || null,
      imageUrl,
      uploadedBy: req.user.id
    });

    const populatedNotice = await Notice.findById(notice._id)
      .populate('uploadedBy', 'firstName lastName email');

    res.status(201).json({
      success: true,
      message: 'Notice created successfully',
      data: populatedNotice
    });
  } catch (error) {
    console.error('Error creating notice:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating notice: ' + error.message
    });
  }
};

// @desc    Delete notice
// @route   DELETE /api/notices/:id
// @access  Admin only
exports.deleteNotice = async (req, res) => {
  try {
    const notice = await Notice.findById(req.params.id);

    if (!notice) {
      return res.status(404).json({
        success: false,
        message: 'Notice not found'
      });
    }

    // Delete image file if exists
    if (notice.imageUrl) {
      try {
        const imagePath = notice.imageUrl.split(req.get('host'))[1];
        const fullPath = path.join(__dirname, '..', imagePath);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } catch (fileError) {
        console.error('Error deleting image file:', fileError);
      }
    }

    await Notice.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Notice deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notice:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting notice'
    });
  }
};
