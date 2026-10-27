import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from './button';
import { Home, FileText, Utensils, Bus, User, LogIn, LogOut, Shield, Bell, QrCode, Building2, UserCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { NotificationBell } from '@/components/NotificationBell';

interface NavigationProps {
  className?: string;
}

export const Navigation: React.FC<NavigationProps> = ({ className }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, isWarden, isSecurity, isSuperAdmin, logout } = useAuth();
  const { toast } = useToast();

  const handleLogout = async () => {
    await logout();
    toast({
      title: "Logged Out",
      description: "You have been successfully logged out.",
    });
    navigate('/login', { replace: true });
  };

  // Role-based navigation items
  const getNavItems = () => {
    if (isSuperAdmin) {
      return [
        { path: '/super-admin/dashboard', label: 'Super Admin', icon: Shield },
        { path: '/admin/dashboard', label: 'Admin Dashboard', icon: Home },
        { path: '/admin/users', label: 'Users', icon: User },
        { path: '/admin/complaints', label: 'Complaints', icon: FileText },
        { path: '/outpass/admin/all', label: 'Outpasses', icon: QrCode },
        { path: '/mess-menu', label: 'Mess Menu', icon: Utensils },
        { path: '/notice-board', label: 'Notices', icon: Bell },
      ];
    } else if (isAdmin) {
      return [
        { path: '/admin/dashboard', label: 'Admin Dashboard', icon: Home },
        { path: '/admin/dashboard?tab=users', label: 'Users', icon: User },
        { path: '/admin/dashboard?tab=rooms', label: 'Rooms', icon: Building2 },
        { path: '/admin/dashboard?tab=outpasses', label: 'Outpasses', icon: QrCode },
        { path: '/admin/dashboard?tab=attendance', label: 'Gate Activity', icon: Shield },
        { path: '/admin/dashboard?tab=notices', label: 'Notices', icon: Bell },
        { path: '/admin/dashboard?tab=mess', label: 'Mess Menu', icon: Utensils },
      ];
    } else if (isWarden) {
      return [
        { path: '/warden/dashboard', label: 'Warden Dashboard', icon: Home },
        { path: '/warden/hostel', label: 'My Hostel', icon: Building2 },
        { path: '/warden/students', label: 'Students', icon: User },
        { path: '/warden/pending-students', label: 'Pending Students', icon: UserCheck },
        { path: '/warden/complaints', label: 'Complaints', icon: FileText },
        { path: '/warden/outpasses', label: 'Outpasses', icon: QrCode },
        { path: '/warden/gate-activity', label: 'Gate Activity', icon: Shield },
      ];
    } else if (isSecurity) {
      return [
        { path: '/security/dashboard', label: 'Security Dashboard', icon: Shield },
        { path: '/security/attendance', label: 'Gate Attendance', icon: Bell },
        { path: '/outpass/verify-qr', label: 'Verify Pass', icon: QrCode },
      ];
    } else {
      // Student
      return [
        { path: '/', label: 'Home', icon: Home },
        { path: '/dashboard', label: 'Dashboard', icon: Home },
        { path: '/profile', label: 'Profile', icon: User },
        { path: '/complaints', label: 'Complaints', icon: FileText },
        { path: '/outpass/my', label: 'My Outpasses', icon: QrCode },
        { path: '/mess-menu', label: 'Mess Menu', icon: Utensils },
        { path: '/bus-routes', label: 'Bus Routes', icon: Bus },
        { path: '/notice-board', label: 'Notices', icon: Bell },
      ];
    }
  };

  return (
    <nav className={cn("bg-card/80 backdrop-blur-md border-b border-border/50 sticky top-0 z-50", className)}>
      <div className="container mx-auto px-4 lg:px-6">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-10 h-10 gradient-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">S</span>
            </div>
            <div className="hidden sm:block">
              <h2 className="font-bold text-lg text-foreground">Symbiosis HMS</h2>
              <p className="text-xs text-muted-foreground">Hostel Management System</p>
            </div>
          </Link>

          <div className="hidden md:flex items-center space-x-1">
            {getNavItems().map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className="flex items-center space-x-2 transition-smooth"
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </div>

          <div className="flex items-center space-x-2">
            {isAuthenticated ? (
              <>
                {/* Notifications Bell */}
                <NotificationBell />

                {/* Profile button */}
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/profile" className="flex items-center space-x-2">
                    <User className="w-4 h-4" />
                    <span className="hidden sm:inline">
                      {user?.firstName || user?.email?.split('@')[0] || 'Profile'}
                    </span>
                  </Link>
                </Button>

                {/* Logout button */}
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleLogout}
                  className="flex items-center space-x-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </Button>
              </>
            ) : (
              <>
                {/* Login button when not authenticated */}
                <Button variant="default" size="sm" asChild>
                  <Link to="/login" className="flex items-center space-x-2">
                    <LogIn className="w-4 h-4" />
                    <span>Login</span>
                  </Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};