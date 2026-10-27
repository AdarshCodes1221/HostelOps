const MessMenu = require('../models/MessMenu');
const path = require('path');

// @desc    Get all mess menu items
// @route   GET /api/mess-menu
// @access  Public
exports.getAllMenus = async (req, res) => {
  try {
    const menus = await MessMenu.find()
      .populate('lastUpdatedBy', 'name')
      .sort({ day: 1, mealType: 1 });
    
    res.status(200).json({
      success: true,
      count: menus.length,
      data: menus
    });
  } catch (error) {
    console.error('Error fetching menus:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching menu data'
    });
  }
};

// @desc    Create or update mess menu
// @route   POST /api/admin/mess-menu
// @access  Admin only
exports.createMenu = async (req, res) => {
  try {
    const { day, mealType, items } = req.body;

    if (!day || !mealType || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Day, meal type, and items are required'
      });
    }

    // Check if menu already exists for this day and meal type
    const existingMenu = await MessMenu.findOne({ day: day.toLowerCase(), mealType: mealType.toLowerCase() });

    if (existingMenu) {
      // Update existing menu
      existingMenu.items = items;
      if (req.body.imageUrl !== undefined) existingMenu.imageUrl = req.body.imageUrl;
      existingMenu.lastUpdatedBy = req.user.id;
      await existingMenu.save();

      return res.status(200).json({
        success: true,
        message: 'Menu updated successfully',
        data: existingMenu
      });
    }

    // Create new menu
    const menu = await MessMenu.create({
      day: day.toLowerCase(),
      mealType: mealType.toLowerCase(),
      items,
      imageUrl: req.body.imageUrl || null,
      lastUpdatedBy: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Menu created successfully',
      data: menu
    });
  } catch (error) {
    console.error('Error creating menu:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating menu'
    });
  }
};

// @desc    Update mess menu
// @route   PUT /api/admin/mess-menu/:id
// @access  Admin only
exports.updateMenu = async (req, res) => {
  try {
    const { items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Items are required'
      });
    }

    const menu = await MessMenu.findById(req.params.id);

    if (!menu) {
      return res.status(404).json({
        success: false,
        message: 'Menu not found'
      });
    }

    menu.items = items;
    if (req.body.imageUrl !== undefined) menu.imageUrl = req.body.imageUrl;
    menu.lastUpdatedBy = req.user.id;
    await menu.save();

    res.status(200).json({
      success: true,
      message: 'Menu updated successfully',
      data: menu
    });
  } catch (error) {
    console.error('Error updating menu:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating menu'
    });
  }
};

// @desc    Batch create/update menus from OCR data
// @route   POST /api/admin/mess-menu/batch
// @access  Admin only
exports.batchCreateMenus = async (req, res) => {
  try {
    const { menus } = req.body;

    if (!menus || !Array.isArray(menus) || menus.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Menus array is required'
      });
    }

    const results = [];
    const errors = [];

    for (const menuData of menus) {
      try {
        const { day, mealType, items, imageUrl } = menuData;

        if (!day || !mealType || !items || items.length === 0) {
          errors.push({ menuData, error: 'Missing required fields' });
          continue;
        }

        const existingMenu = await MessMenu.findOne({ 
          day: day.toLowerCase(), 
          mealType: mealType.toLowerCase() 
        });

        if (existingMenu) {
          existingMenu.items = items;
          if (imageUrl !== undefined) existingMenu.imageUrl = imageUrl;
          existingMenu.lastUpdatedBy = req.user.id;
          await existingMenu.save();
          results.push(existingMenu);
        } else {
          const newMenu = await MessMenu.create({
            day: day.toLowerCase(),
            mealType: mealType.toLowerCase(),
            items,
            imageUrl: imageUrl || null,
            lastUpdatedBy: req.user.id
          });
          results.push(newMenu);
        }
      } catch (error) {
        errors.push({ menuData, error: error.message });
      }
    }

    res.status(200).json({
      success: true,
      message: `Processed ${results.length} menus successfully`,
      data: results,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error batch creating menus:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing menu batch'
    });
  }
};

// @desc    Get latest active mess menu
// @route   GET /api/mess-menu/latest
// @access  Public
exports.getLatestMenu = async (req, res) => {
  try {
    const latest = await MessMenu.findOne({
      imageUrl: { $ne: null, $exists: true }
    })
      .sort({ updatedAt: -1 })
      .populate('lastUpdatedBy', 'firstName lastName name');

    res.status(200).json({
      success: true,
      data: latest || null
    });
  } catch (error) {
    console.error('Error fetching latest menu:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching latest menu'
    });
  }
};

// @desc    Upload mess menu image (admin fallback)
// @route   POST /api/mess-menu/upload-image
// @access  Admin only
exports.uploadMenuImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Image file is required' });
    }

    const { day, mealType } = req.body;
    const weekStartDate = (req.body.weekStartDate || '').toString().trim();
    const relativeUrl = `/uploads/mess-menu/${req.file.filename}`;

    // If day and mealType are provided, save to specific menu
    if (day && mealType) {
      const menu = await MessMenu.findOneAndUpdate(
        { 
          day: day.toLowerCase(), 
          mealType: mealType.toLowerCase() 
        },
        {
          imageUrl: relativeUrl,
          weekStartDate,
          lastUpdatedBy: req.user.id
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      return res.status(200).json({ success: true, message: 'Menu image uploaded', data: menu });
    }

    // Weekly master menu: Upsert the primary weekly schedule document
    const weeklyMenu = await MessMenu.findOneAndUpdate(
      { day: 'weekly', mealType: 'all' },
      {
        imageUrl: relativeUrl,
        weekStartDate,
        items: ['Weekly Master Menu Schedule'],
        lastUpdatedBy: req.user.id
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Also update any existing daily menu documents
    await MessMenu.updateMany(
      { _id: { $ne: weeklyMenu._id } },
      {
        $set: {
          imageUrl: relativeUrl,
          weekStartDate,
          lastUpdatedBy: req.user.id
        }
      }
    );

    res.status(200).json({
      success: true,
      message: 'Weekly menu image uploaded successfully',
      data: weeklyMenu
    });
  } catch (error) {
    console.error('Error uploading menu image:', error);
    res.status(500).json({ success: false, message: 'Error uploading menu image: ' + error.message });
  }
};
