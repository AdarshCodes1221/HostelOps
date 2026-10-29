import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigation } from '@/components/ui/navigation';
import Footer from '@/components/ui/footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Upload, Loader2, Trash2, X, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedFetch, API_ENDPOINTS } from '@/lib/api-config';

interface Notice {
  _id: string;
  title?: string;
  description?: string;
  imageUrl: string;
  uploadedBy: {
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
}

const NoticeBoard = () => {
  const { user, isAuthenticated, isAdmin, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [notices, setNotices] = useState<Notice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeDescription, setNoticeDescription] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);

  const fetchNotices = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await authenticatedFetch(API_ENDPOINTS.NOTICES_ALL);
      const data = await response.json();
      if (response.ok && data?.data) {
        setNotices(data.data);
      } else {
        setNotices([]);
      }
    } catch (error) {
      console.error('Error fetching notices:', error);
      toast({
        title: 'Error',
        description: 'Could not load notices',
        variant: 'destructive'
      });
      setNotices([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchNotices();
  }, [fetchNotices]);



  // Auth guard
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    navigate('/login');
    return null;
  }


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file',
        description: 'Please upload an image file',
        variant: 'destructive'
      });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 5MB',
        variant: 'destructive'
      });
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: 'No file selected',
        description: 'Please select an image to upload',
        variant: 'destructive'
      });
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('image', selectedFile);
      if (noticeTitle) formData.append('title', noticeTitle);
      if (noticeDescription) formData.append('description', noticeDescription);

      const response = await authenticatedFetch(API_ENDPOINTS.NOTICES_CREATE, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Notice uploaded successfully'
        });
        setSelectedFile(null);
        setNoticeTitle('');
        setNoticeDescription('');
        setShowUploadForm(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        fetchNotices();
      } else {
        toast({
          title: 'Upload failed',
          description: data.message || 'Could not upload notice',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error uploading notice:', error);
      toast({
        title: 'Error',
        description: 'Could not upload notice',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (noticeId: string) => {
    if (!window.confirm('Are you sure you want to delete this notice?')) {
      return;
    }

    try {
      const response = await authenticatedFetch(API_ENDPOINTS.NOTICES_DELETE(noticeId), {
        method: 'DELETE'
      });

      if (response.ok) {
        toast({
          title: 'Success',
          description: 'Notice deleted successfully'
        });
        fetchNotices();
      } else {
        const data = await response.json();
        toast({
          title: 'Delete failed',
          description: data.message || 'Could not delete notice',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error deleting notice:', error);
      toast({
        title: 'Error',
        description: 'Could not delete notice',
        variant: 'destructive'
      });
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <>
      <div className="min-h-screen bg-background">
        <Navigation />

        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold gradient-primary bg-clip-text text-transparent">
              Notice Board
            </h1>
            {isAdmin && (
              <Button onClick={() => setShowUploadForm(true)} className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload Notice
              </Button>
            )}
          </div>

          {/* Upload Form Dialog */}
          {isAdmin && (
            <Dialog open={showUploadForm} onOpenChange={setShowUploadForm}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Upload New Notice</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="notice-image">Notice Image *</Label>
                    <Input
                      id="notice-image"
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                    />
                    {selectedFile && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Selected: {selectedFile.name}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="notice-title">Title (Optional)</Label>
                    <Input
                      id="notice-title"
                      value={noticeTitle}
                      onChange={(e) => setNoticeTitle(e.target.value)}
                      placeholder="Enter notice title"
                    />
                  </div>
                  <div>
                    <Label htmlFor="notice-description">Description (Optional)</Label>
                    <Textarea
                      id="notice-description"
                      value={noticeDescription}
                      onChange={(e) => setNoticeDescription(e.target.value)}
                      placeholder="Enter notice description"
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowUploadForm(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpload} disabled={!selectedFile || isUploading}>
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      'Upload'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {/* Image Modal */}
          <Dialog open={showImageModal} onOpenChange={setShowImageModal}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>{selectedNotice?.title || 'Notice'}</DialogTitle>
              </DialogHeader>
              {selectedNotice && (
                <div className="space-y-4">
                  <img
                    src={selectedNotice.imageUrl}
                    alt={selectedNotice.title || 'Notice'}
                    className="w-full h-auto rounded-lg"
                  />
                  {selectedNotice.description && (
                    <p className="text-sm text-muted-foreground">{selectedNotice.description}</p>
                  )}
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Notices Grid */}
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : notices.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No notices available</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {notices.map((notice) => (
                <Card key={notice._id} className="overflow-hidden hover:shadow-lg transition-shadow">
                  <div
                    className="relative cursor-pointer group"
                    onClick={() => {
                      setSelectedNotice(notice);
                      setShowImageModal(true);
                    }}
                  >
                    <img
                      src={notice.imageUrl}
                      alt={notice.title || 'Notice'}
                      className="w-full h-64 object-cover transition-transform group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  </div>
                  <CardContent className="p-4">
                    {notice.title && (
                      <h3 className="font-semibold text-lg mb-2">{notice.title}</h3>
                    )}
                    {notice.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {notice.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(notice.createdAt)}
                      </div>
                      {isAdmin && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(notice._id);
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
};

export default NoticeBoard;
