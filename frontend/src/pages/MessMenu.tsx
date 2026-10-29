import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Navigation } from '@/components/ui/navigation';
import Footer from '@/components/ui/footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  Loader2,
  Calendar,
  ExternalLink,
  Download,
  UtensilsCrossed,
  RefreshCw,
  AlertCircle,
  Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedFetch, API_ENDPOINTS, resolveAssetUrl } from '@/lib/api-config';

interface MenuImage {
  _id?: string;
  imageUrl: string;
  updatedAt?: string;
  createdAt?: string;
  weekStartDate?: string;
}

const MessMenu = () => {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [latestMenu, setLatestMenu] = useState<MenuImage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [weekStartDate, setWeekStartDate] = useState('');
  const [imageError, setImageError] = useState(false);

  const fetchLatestMenuImage = useCallback(async () => {
    try {
      setIsLoading(true);
      setImageError(false);

      // 1. Try dedicated latest endpoint
      const latestRes = await authenticatedFetch(API_ENDPOINTS.MESS_MENU_LATEST);
      if (latestRes.ok) {
        const latestData = await latestRes.json();
        if (latestData?.data && latestData.data.imageUrl) {
          setLatestMenu({
            _id: latestData.data._id,
            imageUrl: resolveAssetUrl(latestData.data.imageUrl),
            updatedAt: latestData.data.updatedAt || latestData.data.createdAt,
            weekStartDate: latestData.data.weekStartDate || '',
          });
          setIsLoading(false);
          return;
        }
      }

      // 2. Fallback to all menus
      const response = await authenticatedFetch(API_ENDPOINTS.MESS_MENU_ALL);
      const data = await response.json();

      if (response.ok && Array.isArray(data?.data) && data.data.length > 0) {
        const withImages = (data.data as MenuImage[]).filter((m: MenuImage) => m && m.imageUrl);
        if (withImages.length > 0) {
          const sorted = withImages.sort(
            (a: MenuImage, b: MenuImage) =>
              new Date(b.updatedAt || b.createdAt || 0).getTime() -
              new Date(a.updatedAt || a.createdAt || 0).getTime()
          );
          setLatestMenu({
            _id: sorted[0]._id,
            imageUrl: resolveAssetUrl(sorted[0].imageUrl),
            updatedAt: sorted[0].updatedAt || sorted[0].createdAt,
            weekStartDate: sorted[0].weekStartDate || '',
          });
        } else {
          setLatestMenu(null);
        }
      } else {
        setLatestMenu(null);
      }
    } catch (error) {
      console.error('Error fetching mess menu image:', error);
      toast({
        title: 'Network Error',
        description: 'Could not load mess menu. Please try again.',
        variant: 'destructive',
      });
      setLatestMenu(null);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchLatestMenuImage();
  }, [fetchLatestMenuImage]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    if (!file.type.startsWith('image/') || !/(jpeg|jpg|png|webp)$/i.test(file.type)) {
      toast({
        title: 'Invalid File Type',
        description: 'Please select a valid image file (PNG, JPG, JPEG, or WEBP).',
        variant: 'destructive',
      });
      setSelectedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Limit client-side preview size to 10MB
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File Too Large',
        description: 'Menu image must be under 10MB.',
        variant: 'destructive',
      });
      setSelectedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: 'No File Selected',
        description: 'Please choose an image before clicking upload.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      if (weekStartDate) {
        formData.append('weekStartDate', weekStartDate);
      }

      const response = await authenticatedFetch(API_ENDPOINTS.MESS_MENU_UPLOAD_IMAGE, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data?.success) {
        toast({
          title: 'Menu Uploaded Successfully',
          description: 'The weekly mess menu has been published for all students.',
        });
        setSelectedFile(null);
        setPreviewUrl(null);
        setWeekStartDate('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchLatestMenuImage();
      } else {
        toast({
          title: 'Upload Failed',
          description: data?.message || 'Failed to upload menu image.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error uploading menu image:', error);
      toast({
        title: 'Upload Error',
        description: 'A network error occurred while uploading. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-background flex flex-col">
        <Navigation />

        <main className="flex-1 container mx-auto px-4 py-8 space-y-8 max-w-6xl">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
            <div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <UtensilsCrossed className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Hostel Mess Menu</h1>
                  <p className="text-muted-foreground text-sm">
                    Symbiosis Institute of Technology &middot; Weekly Dining Schedule
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchLatestMenuImage}
                disabled={isLoading}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>

              {latestMenu?.imageUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="gap-2"
                >
                  <a
                    href={latestMenu.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Original
                  </a>
                </Button>
              )}
            </div>
          </div>

          {/* Admin Upload Console */}
          {isAdmin && (
            <Card className="border-primary/20 bg-card/60 backdrop-blur shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Upload className="w-5 h-5 text-primary" />
                    Publish Weekly Menu (Administrator)
                  </CardTitle>
                  <Badge variant="secondary">Admin Action</Badge>
                </div>
                <CardDescription>
                  Upload the official cafeteria / mess schedule image for students to view.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="weekStart">Week Start Date (Optional)</Label>
                    <Input
                      id="weekStart"
                      type="date"
                      value={weekStartDate}
                      onChange={(e) => setWeekStartDate(e.target.value)}
                      className="bg-background"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="menuFile">Menu Image (PNG, JPG, WEBP)</Label>
                    <Input
                      id="menuFile"
                      type="file"
                      accept="image/png, image/jpeg, image/jpg, image/webp"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="bg-background cursor-pointer"
                    />
                  </div>
                </div>

                {previewUrl && (
                  <div className="mt-4 p-3 border rounded-lg bg-muted/30">
                    <p className="text-xs font-medium text-muted-foreground mb-2">New Upload Preview:</p>
                    <img
                      src={previewUrl}
                      alt="Selected upload preview"
                      className="max-h-48 rounded object-contain border bg-background"
                    />
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleUpload}
                    disabled={isUploading || !selectedFile}
                    className="gap-2"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Uploading Menu...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Publish Schedule
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Menu Display Card */}
          <Card className="shadow-md overflow-hidden">
            <CardHeader className="border-b bg-muted/10 pb-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  Active Weekly Schedule
                </CardTitle>

                {latestMenu?.weekStartDate && (
                  <Badge variant="outline" className="gap-1.5 py-1 px-3 text-xs font-semibold">
                    <Calendar className="w-3.5 h-3.5" />
                    Week Starting: {latestMenu.weekStartDate}
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-6">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-24 space-y-4">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground animate-pulse">
                    Loading latest dining schedule...
                  </p>
                </div>
              ) : latestMenu?.imageUrl && !imageError ? (
                <div className="space-y-4">
                  <div className="relative group rounded-xl overflow-hidden border bg-background flex items-center justify-center min-h-[360px] max-h-[720px]">
                    <img
                      src={latestMenu.imageUrl}
                      alt="Hostel Weekly Mess Menu"
                      className="w-full h-auto max-h-[700px] object-contain rounded-lg transition-transform duration-300 group-hover:scale-[1.01]"
                      onError={() => setImageError(true)}
                      loading="lazy"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground pt-2 border-t gap-2">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      <span>
                        Last updated:{' '}
                        {latestMenu.updatedAt
                          ? new Date(latestMenu.updatedAt).toLocaleString('en-IN', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })
                          : 'Recently'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                        className="h-7 text-xs gap-1.5"
                      >
                        <a
                          href={latestMenu.imageUrl}
                          download="symbiosis-mess-menu.png"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20 px-4 space-y-4">
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                    {imageError ? (
                      <AlertCircle className="w-7 h-7 text-destructive" />
                    ) : (
                      <UtensilsCrossed className="w-7 h-7" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold">
                      {imageError ? 'Unable to load menu image' : 'No Menu Uploaded Yet'}
                    </h3>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      {imageError
                        ? 'The menu image could not be retrieved from the server. Please click refresh or contact hostel administration.'
                        : 'The hostel administration has not published the dining schedule for this week yet. Please check back shortly.'}
                    </p>
                  </div>
                  {imageError && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchLatestMenuImage}
                      className="gap-2"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Try Again
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default MessMenu;