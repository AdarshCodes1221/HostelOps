import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Loader2, Info, AlertTriangle, CheckCircle2, MessageSquare, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { authenticatedFetch, API_ENDPOINTS } from '@/lib/api-config';
import { useAuth } from '@/contexts/AuthContext';

interface NotificationItem {
  _id: string;
  title: string;
  message: string;
  type: string;
  entityId?: string;
  entityType?: string;
  actionUrl?: string;
  read: boolean;
  createdAt: string;
}

export const NotificationBell: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetchUnreadCount = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.NOTIFICATIONS_UNREAD_COUNT);
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (err) {
      // Background poll silently fails
    }
  };

  const fetchNotifications = async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.NOTIFICATIONS_MY);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.data || []);
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchUnreadCount();
      // Poll every 30 seconds as reliable fallback
      const timer = setInterval(fetchUnreadCount, 30000);
      return () => clearInterval(timer);
    }
  }, [isAuthenticated]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      fetchNotifications();
      fetchUnreadCount();
    }
  };

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.NOTIFICATION_MARK_READ(id), {
        method: 'PUT',
      });
      if (res.ok) {
        setNotifications((prev) =>
          prev.map((n) => (n._id === id ? { ...n, read: true } : n))
        );
        setUnreadCount((c) => Math.max(c - 1, 0));
      }
    } catch (err) {
      console.error('Failed to mark notification read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.NOTIFICATIONS_MARK_ALL_READ, {
        method: 'PUT',
      });
      if (res.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleNotificationClick = (n: NotificationItem) => {
    if (!n.read) {
      handleMarkAsRead(n._id);
    }
    setIsOpen(false);

    let targetUrl = n.actionUrl;

    if (!targetUrl) {
      if (isAdmin) {
        switch (n.type) {
          case 'registration':
            targetUrl = n.entityId ? `/admin/dashboard?tab=pending&studentId=${n.entityId}` : '/admin/dashboard?tab=pending';
            break;
          case 'complaint':
          case 'complaint_escalation':
            targetUrl = n.entityId ? `/admin/dashboard?tab=complaints&complaintId=${n.entityId}` : '/admin/dashboard?tab=complaints';
            break;
          case 'room_change_request':
            targetUrl = n.entityId ? `/admin/dashboard?tab=rooms&requestId=${n.entityId}` : '/admin/dashboard?tab=rooms';
            break;
          case 'outpass':
          case 'outpass_request':
            targetUrl = n.entityId ? `/admin/dashboard?tab=outpasses&outpassId=${n.entityId}` : '/admin/dashboard?tab=outpasses';
            break;
          case 'mess-menu':
            targetUrl = '/mess-menu';
            break;
          case 'notice':
            targetUrl = '/notice-board';
            break;
          default:
            targetUrl = '/admin/dashboard';
            break;
        }
      } else {
        switch (n.type) {
          case 'complaint':
          case 'complaint_escalation':
            targetUrl = n.entityId ? `/complaints?complaintId=${n.entityId}` : '/complaints';
            break;
          case 'outpass':
          case 'outpass_approved':
            targetUrl = n.entityId ? `/outpass?outpassId=${n.entityId}&action=view_qr` : '/outpass';
            break;
          case 'allocation':
          case 'room_allocation':
            targetUrl = '/dashboard';
            break;
          case 'mess-menu':
            targetUrl = '/mess-menu';
            break;
          case 'notice':
            targetUrl = '/notice-board';
            break;
          default:
            targetUrl = '/dashboard';
            break;
        }
      }
    }

    if (targetUrl) {
      navigate(targetUrl);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'complaint':
      case 'complaint_escalation':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'allocation':
      case 'approval':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'room_change_request':
      case 'registration':
        return <Info className="w-4 h-4 text-blue-500" />;
      default:
        return <MessageSquare className="w-4 h-4 text-primary" />;
    }
  };

  if (!isAuthenticated) return null;

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative p-2 h-9 w-9 rounded-full hover:bg-accent"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-pulse">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 sm:w-96 p-0 shadow-lg" align="end">
        <div className="flex items-center justify-between p-3 border-b bg-muted/40">
          <div className="flex items-center gap-2">
            <h4 className="font-semibold text-sm">Notifications</h4>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {notifications.some((n) => !n.read) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[360px] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center items-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {notifications.map((n) => (
                <div
                  key={n._id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3.5 flex gap-3 text-left transition hover:bg-muted/50 cursor-pointer ${
                    !n.read ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="mt-0.5 flex-shrink-0">{getTypeIcon(n.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <p className={`text-xs font-semibold truncate ${!n.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>
                    <span className="text-[10px] text-muted-foreground/80 mt-1 block">
                      {new Date(n.createdAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
