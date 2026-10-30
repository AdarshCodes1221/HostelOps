import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Navigation } from '@/components/ui/navigation';
import Footer from '@/components/ui/footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { MapPin, Clock, Bus, Edit, Trash2, Plus, Loader2, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedFetch, API_ENDPOINTS } from '@/lib/api-config';

interface BusRoute {
  _id: string;
  routeName: string;
  stops: string[];
  timings: string[];
  imageUrl?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

const BusRoutes = () => {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [routes, setRoutes] = useState<BusRoute[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState('');
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Image upload states
  const [busRouteImage, setBusRouteImage] = useState<{ imageUrl: string } | null>(null);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);

  const [editFormData, setEditFormData] = useState({
    id: '',
    routeName: '',
    stops: [''],
    timings: [''],
    active: true
  });

  const fetchRoutes = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await authenticatedFetch(API_ENDPOINTS.BUS_ROUTES_ALL);

      if (response.ok) {
        const data = await response.json();
        setRoutes(data.data || []);
      } else {
        toast({
          title: "Error",
          description: "Failed to load bus routes",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error fetching routes:', error);
      toast({
        title: "Error",
        description: "Could not connect to server",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const fetchBusRouteImage = useCallback(async () => {
    try {
      setIsImageLoading(true);
      const response = await authenticatedFetch(API_ENDPOINTS.BUS_ROUTES_IMAGE);
      const data = await response.json();

      if (response.ok && data?.data?.imageUrl) {
        setBusRouteImage(data.data);
      } else {
        setBusRouteImage(null);
      }
    } catch (error) {
      console.error('Error fetching bus route image:', error);
      setBusRouteImage(null);
    } finally {
      setIsImageLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoutes();
    fetchBusRouteImage();
  }, [fetchRoutes, fetchBusRouteImage]);

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setSelectedImageFile(null);
      return;
    }
    if (!file.type.startsWith('image/') || !/(jpeg|jpg|png)$/i.test(file.type)) {
      toast({
        title: 'Invalid file',
        description: 'Please upload a JPG or PNG image',
        variant: 'destructive'
      });
      setSelectedImageFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setSelectedImageFile(file);
  };

  const handleImageUpload = async () => {
    if (!selectedImageFile) {
      toast({ title: 'No file', description: 'Select an image to upload', variant: 'destructive' });
      return;
    }

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', selectedImageFile);

      const response = await authenticatedFetch(API_ENDPOINTS.BUS_ROUTES_UPLOAD_IMAGE, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (response.ok && data?.success) {
        toast({ title: 'Uploaded', description: 'Bus route image uploaded successfully' });
        setSelectedImageFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchBusRouteImage();
      } else {
        toast({ title: 'Upload failed', description: data?.message || 'Could not upload image', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({ title: 'Error', description: 'Could not upload image', variant: 'destructive' });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleImageLoadError = () => {
    setBusRouteImage(null);
  };

  const handleAddNewRoute = () => {
    setEditFormData({
      id: '',
      routeName: '',
      stops: [''],
      timings: [''],
      active: true
    });
    setIsEditDialogOpen(true);
  };

  const handleEditRoute = (route: BusRoute) => {
    setEditFormData({
      id: route._id,
      routeName: route.routeName,
      stops: [...route.stops],
      timings: [...route.timings],
      active: route.active
    });
    setIsEditDialogOpen(true);
  };

  const handleSaveRoute = async () => {
    if (!editFormData.routeName || editFormData.stops.filter(s => s.trim()).length === 0 ||
      editFormData.timings.filter(t => t.trim()).length === 0) {
      toast({
        title: "Validation Error",
        description: "Please fill all required fields",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const filteredStops = editFormData.stops.filter(s => s.trim() !== '');
      const filteredTimings = editFormData.timings.filter(t => t.trim() !== '');

      let response;
      if (editFormData.id) {
        // Update existing
        response = await authenticatedFetch(API_ENDPOINTS.BUS_ROUTES_UPDATE(editFormData.id), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            routeName: editFormData.routeName,
            stops: filteredStops,
            timings: filteredTimings,
            active: editFormData.active
          })
        });
      } else {
        // Create new
        response = await authenticatedFetch(API_ENDPOINTS.BUS_ROUTES_CREATE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            routeName: editFormData.routeName,
            stops: filteredStops,
            timings: filteredTimings,
            active: editFormData.active
          })
        });
      }

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Success",
          description: data.message || "Route saved successfully"
        });
        setIsEditDialogOpen(false);
        fetchRoutes();
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to save route",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error saving route:', error);
      toast({
        title: "Error",
        description: "Could not connect to server",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRoute = async (id: string) => {
    if (!confirm('Are you sure you want to delete this route?')) return;

    try {
      const response = await authenticatedFetch(API_ENDPOINTS.BUS_ROUTES_DELETE(id), {
        method: 'DELETE'
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Success",
          description: "Route deleted successfully"
        });
        fetchRoutes();
      } else {
        toast({
          title: "Error",
          description: data.message || "Failed to delete route",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error deleting route:', error);
      toast({
        title: "Error",
        description: "Could not connect to server",
        variant: "destructive"
      });
    }
  };

  const addStopField = () => {
    setEditFormData({
      ...editFormData,
      stops: [...editFormData.stops, '']
    });
  };

  const removeStopField = (index: number) => {
    const newStops = editFormData.stops.filter((_, i) => i !== index);
    setEditFormData({
      ...editFormData,
      stops: newStops.length > 0 ? newStops : ['']
    });
  };

  const updateStop = (index: number, value: string) => {
    const newStops = [...editFormData.stops];
    newStops[index] = value;
    setEditFormData({
      ...editFormData,
      stops: newStops
    });
  };

  const addTimingField = () => {
    setEditFormData({
      ...editFormData,
      timings: [...editFormData.timings, '']
    });
  };

  const removeTimingField = (index: number) => {
    const newTimings = editFormData.timings.filter((_, i) => i !== index);
    setEditFormData({
      ...editFormData,
      timings: newTimings.length > 0 ? newTimings : ['']
    });
  };

  const updateTiming = (index: number, value: string) => {
    const newTimings = [...editFormData.timings];
    newTimings[index] = value;
    setEditFormData({
      ...editFormData,
      timings: newTimings
    });
  };

  const renderRouteCard = (route: BusRoute) => {
    const hasImage = route.imageUrl && route.imageUrl.trim() !== '';

    return (
      <Card key={route._id} className="shadow-card">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <div className="flex items-center space-x-2">
                <Bus className="w-5 h-5 text-primary" />
                <span className="font-semibold text-lg">{route.routeName}</span>
                {hasImage && <Badge className="text-xs bg-success/20 text-success">Image</Badge>}
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant={route.active ? 'default' : 'secondary'}>
                  {route.active ? 'Active' : 'Inactive'}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {route.stops.length} stops • {route.timings.length} timings
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedRoute(selectedRoute === route._id ? '' : route._id)}
              >
                {selectedRoute === route._id ? 'Hide Route' : 'View Route'}
              </Button>
              {isAdmin && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditRoute(route)}
                    className="h-9 w-9 p-0"
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteRoute(route._id)}
                    className="h-9 w-9 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>

        {selectedRoute === route._id && (
          <CardContent>
            <div className="space-y-4">
              {/* Show image if exists (takes priority) */}
              {hasImage && (
                <div className="w-full">
                  <img
                    src={route.imageUrl}
                    alt={`${route.routeName} route map`}
                    className="w-full h-48 object-cover rounded-md border shadow-sm"
                    loading="lazy"
                  />
                </div>
              )}

              {/* Show details only if no image */}
              {!hasImage && (
                <>
                  <div>
                    <h4 className="font-semibold mb-3 flex items-center space-x-2">
                      <MapPin className="w-4 h-4" />
                      <span>Stops</span>
                    </h4>
                    <div className="space-y-2">
                      {route.stops.map((stop, index) => (
                        <div key={index} className="flex items-center space-x-3 p-2 bg-muted/50 rounded-lg">
                          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${index === 0 ? 'bg-success' :
                              index === route.stops.length - 1 ? 'bg-destructive' :
                                'bg-primary'
                            }`} />
                          <span className="text-sm">{stop}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-3 flex items-center space-x-2">
                      <Clock className="w-4 h-4" />
                      <span>Timings</span>
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {route.timings.map((time, index) => (
                        <Badge key={index} variant="outline" className="justify-center">
                          {time}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }


  return (
    <>
      <div className="min-h-screen bg-background">
        <Navigation />

        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold gradient-primary bg-clip-text text-transparent">
                  Bus Routes & Timings
                </h1>
                <p className="text-muted-foreground mt-2">
                  Comprehensive transport information for Symbiosis hostels
                </p>
              </div>
              {isAdmin && (
                <Button
                  onClick={handleAddNewRoute}
                  className="gradient-primary text-primary-foreground flex items-center space-x-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Route</span>
                </Button>
              )}
            </div>
          </div>

          {/* Bus Route Image Section */}
          {isAdmin && (
            <Card className="shadow-card mb-8 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Bus Route Map Image
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-4">
                  {isImageLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : busRouteImage?.imageUrl ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Current Bus Route Image:</p>
                      <img
                        src={busRouteImage.imageUrl}
                        alt="Bus route map"
                        className="w-full h-auto max-h-96 object-cover rounded-lg border"
                        onError={handleImageLoadError}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No bus route image uploaded yet</p>
                  )}

                  <div className="border-2 border-dashed rounded-lg p-4 text-center">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,.jpg,.jpeg,.png"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full"
                      disabled={isUploadingImage}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {selectedImageFile ? `Selected: ${selectedImageFile.name}` : 'Choose Image (JPG/PNG)'}
                    </Button>
                    {selectedImageFile && (
                      <p className="text-xs text-muted-foreground mt-2">{selectedImageFile.name}</p>
                    )}
                  </div>

                  {selectedImageFile && (
                    <Button
                      onClick={handleImageUpload}
                      disabled={isUploadingImage}
                      className="w-full gradient-primary text-primary-foreground"
                    >
                      {isUploadingImage ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Uploading...
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Bus Route Image
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Student View - Show Image if exists */}
          {!isAdmin && busRouteImage?.imageUrl && (
            <Card className="shadow-card mb-8">
              <CardHeader>
                <CardTitle>Bus Route Map</CardTitle>
              </CardHeader>
              <CardContent>
                <img
                  src={busRouteImage.imageUrl}
                  alt="Bus route map"
                  className="w-full h-auto rounded-lg border"
                  onError={handleImageLoadError}
                />
              </CardContent>
            </Card>
          )}

          <div className="space-y-6">
            {routes.length === 0 ? (
              <Card className="shadow-card">
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    <Bus className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No bus routes available yet</p>
                    {isAdmin && <p className="text-sm mt-2">Click "Add New Route" to get started</p>}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className="shadow-card">
                  <CardHeader>
                    <CardTitle>Available Bus Routes</CardTitle>
                    <Select value={selectedRoute} onValueChange={setSelectedRoute}>
                      <SelectTrigger className="w-full max-w-xs">
                        <SelectValue placeholder="Quick select route" />
                      </SelectTrigger>
                      <SelectContent>
                        {routes.filter(r => r.active).map((route) => (
                          <SelectItem key={route._id} value={route._id}>
                            {route.routeName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardHeader>
                </Card>

                <div className="space-y-4">
                  {routes.filter(r => isAdmin || r.active).map(renderRouteCard)}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Edit/Add Route Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editFormData.id ? 'Edit Bus Route' : 'Add New Bus Route'}</DialogTitle>
              <DialogDescription>
                {editFormData.id ? 'Update the route details below' : 'Create a new bus route'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Route Name</Label>
                <Input
                  value={editFormData.routeName}
                  onChange={(e) => setEditFormData({ ...editFormData, routeName: e.target.value })}
                  placeholder="e.g., Pune Station - Hostel"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Stops</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addStopField}
                    className="flex items-center space-x-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Stop</span>
                  </Button>
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {editFormData.stops.map((stop, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Input
                        value={stop}
                        onChange={(e) => updateStop(index, e.target.value)}
                        placeholder={`Stop ${index + 1}`}
                      />
                      {editFormData.stops.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeStopField(index)}
                          className="flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Timings</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addTimingField}
                    className="flex items-center space-x-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Timing</span>
                  </Button>
                </div>
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {editFormData.timings.map((timing, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Input
                        value={timing}
                        onChange={(e) => updateTiming(index, e.target.value)}
                        placeholder="e.g., 7:00 AM"
                      />
                      {editFormData.timings.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTimingField(index)}
                          className="flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="space-y-1">
                  <Label>Active Status</Label>
                  <p className="text-xs text-muted-foreground">
                    {editFormData.active ? 'Route is visible to students' : 'Route is hidden from students'}
                  </p>
                </div>
                <Switch
                  checked={editFormData.active}
                  onCheckedChange={(checked) => setEditFormData({ ...editFormData, active: checked })}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveRoute}
                  disabled={isSubmitting}
                  className="gradient-primary text-primary-foreground"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editFormData.id ? 'Update Route' : 'Create Route'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <Footer />
    </>
  );
};

export default BusRoutes;