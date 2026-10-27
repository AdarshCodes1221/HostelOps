import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Navigation } from "@/components/ui/navigation";
import Footer from "@/components/ui/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Home, Book, Calendar, Loader2, Bell, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { authenticatedFetch, API_ENDPOINTS } from "@/lib/api-config";

interface Notification {
  _id: string;
  title: string;
  message: string;
  createdAt: string;
  type: string;
}

interface Notice {
  _id: string;
  title?: string;
  imageUrl: string;
  createdAt: string;
}

const Dashboard: React.FC = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [outpassCount, setOutpassCount] = useState<number | null>(null);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);
  const [isLoadingNotices, setIsLoadingNotices] = useState(true);

  useEffect(() => {
    fetchNotifications();
    fetchNotices();
    fetchOutpassCount();
  }, []);

  const fetchOutpassCount = async () => {
    try {
      const response = await authenticatedFetch(API_ENDPOINTS.OUTPASS_MY);
      const data = await response.json();
      if (response.ok && data?.data) {
        const active = (data.data as { status: string }[]).filter(
          (p) => p.status === 'approved' || p.status === 'pending'
        ).length;
        setOutpassCount(active);
      }
    } catch {
      setOutpassCount(0);
    }
  };

  const fetchNotifications = async () => {
    try {
      setIsLoadingNotifications(true);
      const response = await authenticatedFetch(API_ENDPOINTS.NOTIFICATIONS_MY);
      const data = await response.json();
      
      if (response.ok && data?.data) {
        setNotifications(data.data);
      } else {
        setNotifications([]);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  const fetchNotices = async () => {
    try {
      setIsLoadingNotices(true);
      const response = await authenticatedFetch(API_ENDPOINTS.NOTICES_ALL);
      const data = await response.json();
      
      if (response.ok && data?.data) {
        setNotices(data.data.slice(0, 3));
      } else {
        setNotices([]);
      }
    } catch (error) {
      console.error('Error fetching notices:', error);
      setNotices([]);
    } finally {
      setIsLoadingNotices(false);
    }
  };

  const formatTime = (createdAt: string) => {
    const date = new Date(createdAt);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Auth guard: Check auth state first
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

  // Auth guard: Redirect if not authenticated
  if (!isAuthenticated || !user) {
    navigate('/login');
    return null;
  }

  return (
    <>
      <div className="min-h-screen bg-background">
        <Navigation />
        
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold gradient-primary bg-clip-text text-transparent mb-6">
            Dashboard
          </h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Welcome Back
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4 text-primary" />
                <span className="text-2xl font-bold">{user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : '—'}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{user?.email || '—'}</p>
            </CardContent>
          </Card>
          
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Hostel Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Home className="w-4 h-4 text-primary" />
                <span className="text-2xl font-bold">{user?.hostel || '—'}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Room {user?.roomNumber || '—'}</p>
            </CardContent>
          </Card>
          
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Outpasses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Book className="w-4 h-4 text-primary" />
                <span className="text-2xl font-bold">{outpassCount ?? '—'}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Pending or approved</p>
            </CardContent>
          </Card>
          
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Notices
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-2xl font-bold">{notices.length > 0 ? notices.length : '—'}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">Latest notice board</p>
            </CardContent>
          </Card>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Recent Notifications</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingNotifications ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : notifications.length > 0 ? (
                <div className="space-y-3">
                  {notifications.map((notif) => (
                    <div key={notif._id} className="border-l-4 border-primary pl-4 py-2">
                      <p className="font-medium">{notif.title}</p>
                      <p className="text-sm text-muted-foreground">{notif.message}</p>
                      <p className="text-xs text-muted-foreground mt-1">{formatTime(notif.createdAt)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No new notifications</p>
              )}
            </CardContent>
          </Card>
          
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Latest Notices</CardTitle>
              <Link to="/notice-board" className="text-sm text-primary hover:underline flex items-center gap-1">
                View All <ArrowRight className="w-3 h-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {isLoadingNotices ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : notices.length > 0 ? (
                <div className="space-y-3">
                  {notices.map((notice) => (
                    <Link 
                      key={notice._id} 
                      to="/notice-board"
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent transition-smooth"
                    >
                      <img
                        src={notice.imageUrl}
                        alt={notice.title || 'Notice'}
                        className="w-16 h-16 object-cover rounded"
                      />
                      <div className="flex-1">
                        <p className="font-medium">{notice.title || 'Notice'}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(notice.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Bell className="w-4 h-4 text-primary" />
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No notices available</p>
              )}
            </CardContent>
          </Card>
        </div>
        
        <Card className="shadow-card mt-6">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <Link to="/complaints" className="block p-4 border rounded-lg hover:bg-accent transition-smooth">
                <p className="font-medium">Submit Complaint</p>
                <p className="text-sm text-muted-foreground">Report issues with your room or facilities</p>
              </Link>
              <Link to="/mess-menu" className="block p-4 border rounded-lg hover:bg-accent transition-smooth">
                <p className="font-medium">View Mess Menu</p>
                <p className="text-sm text-muted-foreground">Check today's meal schedule</p>
              </Link>
              <Link to="/bus-routes" className="block p-4 border rounded-lg hover:bg-accent transition-smooth">
                <p className="font-medium">Bus Schedule</p>
                <p className="text-sm text-muted-foreground">View campus shuttle timings</p>
              </Link>
              <Link to="/profile" className="block p-4 border rounded-lg hover:bg-accent transition-smooth">
                <p className="font-medium">Update Profile</p>
                <p className="text-sm text-muted-foreground">Manage your personal information</p>
              </Link>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
      <Footer />
    </>
  );
};

export default Dashboard;