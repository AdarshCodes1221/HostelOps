const BusRoute = require('../models/BusRoute');
const path = require('path');

// @desc    Get all bus routes
// @route   GET /api/bus-routes
// @access  Public
exports.getAllRoutes = async (req, res) => {
  try {
    const routes = await BusRoute.find().sort({ routeName: 1 });
    
    res.status(200).json({
      success: true,
      count: routes.length,
      data: routes
    });
  } catch (error) {
    console.error('Error fetching routes:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bus routes'
    });
  }
};

// @desc    Create bus route
// @route   POST /api/admin/bus-routes
// @access  Admin only
exports.createRoute = async (req, res) => {
  try {
    const { routeName, stops, timings, active } = req.body;

    if (!routeName || !stops || !timings || stops.length === 0 || timings.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Route name, stops, and timings are required'
      });
    }

    const route = await BusRoute.create({
      routeName,
      stops,
      timings,
      active: active !== undefined ? active : true
    });

    res.status(201).json({
      success: true,
      message: 'Bus route created successfully',
      data: route
    });
  } catch (error) {
    console.error('Error creating route:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating bus route'
    });
  }
};

// @desc    Update bus route
// @route   PUT /api/admin/bus-routes/:id
// @access  Admin only
exports.updateRoute = async (req, res) => {
  try {
    const { routeName, stops, timings, active } = req.body;

    const route = await BusRoute.findById(req.params.id);

    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Bus route not found'
      });
    }

    if (routeName) route.routeName = routeName;
    if (stops) route.stops = stops;
    if (timings) route.timings = timings;
    if (active !== undefined) route.active = active;

    await route.save();

    res.status(200).json({
      success: true,
      message: 'Bus route updated successfully',
      data: route
    });
  } catch (error) {
    console.error('Error updating route:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating bus route'
    });
  }
};

// @desc    Delete bus route
// @route   DELETE /api/admin/bus-routes/:id
// @access  Admin only
exports.deleteRoute = async (req, res) => {
  try {
    const route = await BusRoute.findById(req.params.id);

    if (!route) {
      return res.status(404).json({
        success: false,
        message: 'Bus route not found'
      });
    }

    await route.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Bus route deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting route:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting bus route'
    });
  }
};

// @desc    Upload bus route image
// @route   POST /api/bus-routes/upload-image
// @access  Admin only
exports.uploadRouteImage = async (req, res) => {
  try {
    console.log('Upload route image request received');
    console.log('File:', req.file);
    console.log('Body:', req.body);
    
    if (!req.file) {
      console.error('No file uploaded');
      return res.status(400).json({ success: false, message: 'Image file is required' });
    }

    const filePath = path.join('uploads', 'bus-routes', req.file.filename);
    const imageUrl = `${req.protocol}://${req.get('host')}/${filePath.replace(/\\/g, '/')}`;

    console.log('Image URL:', imageUrl);

    // Apply image to the first route (or create default if none exists)
    let route = await BusRoute.findOne();
    
    if (!route) {
      route = new BusRoute({
        routeName: 'Bus Routes Map',
        stops: [],
        timings: [],
        imageUrl,
        active: true
      });
    } else {
      route.imageUrl = imageUrl;
    }

    await route.save();

    console.log('Route saved:', route._id);
    res.status(200).json({ 
      success: true, 
      message: 'Bus route image uploaded successfully', 
      data: route 
    });
  } catch (error) {
    console.error('Error uploading route image:', error);
    res.status(500).json({ success: false, message: 'Error uploading route image: ' + error.message });
  }
};

// @desc    Get bus route image
// @route   GET /api/bus-routes/image
// @access  Public
exports.getRouteImage = async (req, res) => {
  try {
    const route = await BusRoute.findOne({ imageUrl: { $exists: true, $ne: null } });
    
    if (!route || !route.imageUrl) {
      return res.status(404).json({ 
        success: false, 
        message: 'Bus route image not found' 
      });
    }

    res.status(200).json({ 
      success: true, 
      data: { imageUrl: route.imageUrl } 
    });
  } catch (error) {
    console.error('Error fetching route image:', error);
    res.status(500).json({ success: false, message: 'Error fetching route image' });
  }
};
