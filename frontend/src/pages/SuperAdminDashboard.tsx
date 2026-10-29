import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Navigation } from "@/components/ui/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users,
  Building2,
  DoorOpen,
  Shield,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  QrCode,
  Utensils,
  Bell,
  Activity,
  SlidersHorizontal,
  X,
  UserCheck
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authenticatedFetch, API_ENDPOINTS } from "@/lib/api-config";
import { useAuth } from "@/contexts/AuthContext";

interface HostelBreakdown {
  id: string;
  name: string;
  location: string;
  totalRooms: number;
  fullRooms: number;
  availableRooms: number;
  totalCapacity: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyPercentage: number;
  students: number;
  pendingStudents: number;
  outpassCount: number;
  currentlyOut: number;
  overdue: number;
}

interface SuperAdminStats {
  counts: {
    users: number;
    hostels: number;
    rooms: number;
    totalCapacity?: number;
    occupiedBeds?: number;
    availableBeds?: number;
    occupancyRate?: number;
    occupiedRooms?: number;
    availableRooms?: number;
    bookings: number;
    complaints: number;
    outpasses: number;
    wardens: number;
    security: number;
    admins: number;
    superAdmins: number;
  };
  hostelsBreakdown?: HostelBreakdown[];
}

interface UserData {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  prn?: string;
  phone?: string;
  role: string;
  status: string;
  hostel?: string;
  floor?: string;
  roomNumber?: string;
  isEmailVerified?: boolean;
  createdAt: string;
}

const HOSTEL_OPTIONS = [
  "Voila Hostel",
  "Orchid Hostel",
  "Magnolia Hostel",
  "Symbiosis Royal Hostel",
];

const SuperAdminDashboard: React.FC = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Data states
  const [stats, setStats] = useState<SuperAdminStats | null>(null);
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);

  // Card filter state
  // null | 'all' | 'hostels' | 'rooms' | 'admin' | 'warden' | 'security'
  const [activeCard, setActiveCard] = useState<string | null>(null);

  // Table filters & search
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [hostelFilter, setHostelFilter] = useState("all");

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modals state
  const [detailUser, setDetailUser] = useState<UserData | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editRole, setEditRole] = useState("");
  const [editHostel, setEditHostel] = useState("");
  const [isSavingRole, setIsSavingRole] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<UserData | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Overview dialogs
  const [isHostelsModalOpen, setIsHostelsModalOpen] = useState(false);
  const [isRoomsModalOpen, setIsRoomsModalOpen] = useState(false);

  // Fetch Dashboard summary statistics
  const fetchDashboardData = useCallback(async () => {
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.SUPER_ADMIN_DASHBOARD);
      if (res.ok) {
        const data = await res.json();
        setStats(data.data);
      } else {
        toast({
          title: "Warning",
          description: "Could not fetch full dashboard statistics.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching super admin stats:", error);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Fetch users with current query parameters
  const fetchUsers = useCallback(async (
    targetPage = page,
    targetRole = roleFilter,
    targetStatus = statusFilter,
    targetSearch = searchQuery,
    targetHostel = hostelFilter,
    targetLimit = limit
  ) => {
    setTableLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", targetPage.toString());
      params.set("limit", targetLimit.toString());

      if (targetRole && targetRole !== "all") {
        params.set("role", targetRole);
      }
      if (targetStatus && targetStatus !== "all") {
        params.set("status", targetStatus);
      }
      if (targetHostel && targetHostel !== "all") {
        params.set("hostel", targetHostel);
      }
      if (targetSearch.trim()) {
        params.set("search", targetSearch.trim());
      }

      const res = await authenticatedFetch(
        `${API_ENDPOINTS.SUPER_ADMIN_USERS}?${params.toString()}`
      );
      if (res.ok) {
        const data = await res.json();
        setUsers(data.data || []);
        setTotalUsers(data.total || 0);
        setTotalPages(data.pages || 1);
        setPage(data.page || 1);
      } else {
        toast({
          title: "Error",
          description: "Failed to load users list",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to load users",
        variant: "destructive",
      });
    } finally {
      setTableLoading(false);
    }
  }, [page, roleFilter, statusFilter, searchQuery, hostelFilter, limit, toast]);

  // Initial load
  useEffect(() => {
    fetchDashboardData();
    fetchUsers(1, "all", "all", "", "all", 10);
  }, [fetchDashboardData, fetchUsers]);

  // Card click handler
  const handleCardClick = (cardKey: string) => {
    if (cardKey === "hostels") {
      setActiveCard("hostels");
      setIsHostelsModalOpen(true);
      return;
    }

    if (cardKey === "rooms") {
      setActiveCard("rooms");
      setIsRoomsModalOpen(true);
      return;
    }

    if (cardKey === "all") {
      setActiveCard("all");
      setRoleFilter("all");
      setPage(1);
      fetchUsers(1, "all", statusFilter, searchQuery, hostelFilter, limit);
      return;
    }

    // Role-specific card: 'admin', 'warden', 'security'
    setActiveCard(cardKey);
    setRoleFilter(cardKey);
    setPage(1);
    fetchUsers(1, cardKey, statusFilter, searchQuery, hostelFilter, limit);
  };

  // Clear Selection handler
  const handleClearSelection = () => {
    setActiveCard(null);
    setSearchQuery("");
    setRoleFilter("all");
    setStatusFilter("all");
    setHostelFilter("all");
    setPage(1);
    fetchUsers(1, "all", "all", "", "all", limit);
    toast({
      title: "Filter Cleared",
      description: "Restored full authorized user list.",
    });
  };

  // Search input submit or debounce
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers(1, roleFilter, statusFilter, searchQuery, hostelFilter, limit);
  };

  // Dropdown filter changes
  const handleRoleChange = (newRole: string) => {
    setRoleFilter(newRole);
    setActiveCard(
      newRole === "admin" || newRole === "warden" || newRole === "security"
        ? newRole
        : newRole === "all"
        ? "all"
        : null
    );
    setPage(1);
    fetchUsers(1, newRole, statusFilter, searchQuery, hostelFilter, limit);
  };

  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setPage(1);
    fetchUsers(1, roleFilter, newStatus, searchQuery, hostelFilter, limit);
  };

  const handleHostelChange = (newHostel: string) => {
    setHostelFilter(newHostel);
    setPage(1);
    fetchUsers(1, roleFilter, statusFilter, searchQuery, newHostel, limit);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      fetchUsers(newPage, roleFilter, statusFilter, searchQuery, hostelFilter, limit);
    }
  };

  // Edit Role Action
  const openEditRoleModal = (userItem: UserData) => {
    setEditUser(userItem);
    setEditRole(userItem.role);
    setEditHostel(userItem.hostel || "");
    setIsEditOpen(true);
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;

    if (!editRole) {
      toast({
        title: "Validation Error",
        description: "Please select a valid role.",
        variant: "destructive",
      });
      return;
    }

    // Role protection validation
    if (editUser._id === user?._id && editRole !== "super_admin") {
      toast({
        title: "Action Prohibited",
        description: "You cannot demote your own Super Administrator account.",
        variant: "destructive",
      });
      return;
    }

    setIsSavingRole(true);
    try {
      const payload: { role: string; hostel?: string } = { role: editRole };
      if (editHostel && editHostel !== "none") {
        payload.hostel = editHostel;
      } else if (editHostel === "none") {
        payload.hostel = "";
      }

      const res = await authenticatedFetch(
        API_ENDPOINTS.SUPER_ADMIN_USER_ROLE(editUser._id),
        {
          method: "PUT",
          body: JSON.stringify(payload),
        }
      );

      const resData = await res.json();
      if (res.ok && resData.success) {
        toast({
          title: "Role & Hostel Updated",
          description: `Successfully updated account for ${editUser.firstName} ${editUser.lastName}.`,
        });
        setIsEditOpen(false);
        setEditUser(null);
        // Refresh table & stats
        fetchUsers();
        fetchDashboardData();
      } else {
        toast({
          title: "Update Failed",
          description: resData.message || "Failed to update role.",
          variant: "destructive",
        });
      }
    } catch (err: unknown) {
      console.error("Error updating role:", err);
      const message = err instanceof Error ? err.message : "Network error occurred while saving role.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSavingRole(false);
    }
  };

  // Delete Action
  const openDeleteModal = (userItem: UserData) => {
    // Client-side safety check
    if (userItem._id === user?._id) {
      toast({
        title: "Cannot Delete Account",
        description: "You cannot delete your own currently logged-in account.",
        variant: "destructive",
      });
      return;
    }
    if (
      userItem.role === "super_admin" ||
      userItem.email === "superadmin000@example.com" ||
      userItem.email === "admin000@example.com" ||
      userItem.email === "superadmin@siu.edu.in" ||
      userItem.email === "admin@symbiosis.ac.in"
    ) {
      toast({
        title: "Protected Account",
        description: "Protected root system accounts cannot be deleted.",
        variant: "destructive",
      });
      return;
    }
    setDeleteTarget(userItem);
    setIsDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      const res = await authenticatedFetch(
        API_ENDPOINTS.SUPER_ADMIN_USER_DELETE(deleteTarget._id),
        {
          method: "DELETE",
        }
      );

      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: "User Deleted",
          description: `Account for ${deleteTarget.firstName} ${deleteTarget.lastName} has been permanently deleted.`,
        });
        setIsDeleteOpen(false);
        setDeleteTarget(null);
        fetchUsers();
        fetchDashboardData();
      } else {
        toast({
          title: "Deletion Failed",
          description: data.message || "Unable to delete user.",
          variant: "destructive",
        });
      }
    } catch (err: unknown) {
      console.error("Error deleting user:", err);
      const message = err instanceof Error ? err.message : "Network error deleting user.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Account Detail View
  const openDetailModal = (userItem: UserData) => {
    setDetailUser(userItem);
    setIsDetailOpen(true);
  };

  // Auth Guard
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Authenticating Super Admin session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    navigate("/login");
    return null;
  }

  if (user.role !== "super_admin") {
    navigate("/admin/dashboard");
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading Super Admin Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-12">
      {/* Primary Shared Navbar (Includes single authenticated Logout button) */}
      <Navigation />

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center space-x-3">
              <span className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Shield className="w-7 h-7" />
              </span>
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight">
                  Super Admin Central Dashboard
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Hostel Operations & RBAC System Management across all 4 Symbiosis Hostels
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchDashboardData();
                fetchUsers();
                toast({
                  title: "Refreshed",
                  description: "Dashboard stats and users updated from MongoDB.",
                });
              }}
              className="flex items-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh Data</span>
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate("/admin/dashboard")}
              className="flex items-center space-x-2"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Admin Operations</span>
            </Button>
          </div>
        </div>

        {/* 1. DASHBOARD SUMMARY CARDS (Clickable & Database Driven) */}
        {stats && (
          <section aria-label="Dashboard Statistics" className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  System Live Metrics (Click card to filter user table or inspect)
                </h2>
              </div>
              {activeCard && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearSelection}
                  className="text-xs text-primary hover:underline h-7 px-2"
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Clear Selection
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {/* Card 1: Total Users */}
              <Card
                role="button"
                tabIndex={0}
                onClick={() => handleCardClick("all")}
                onKeyDown={(e) => e.key === "Enter" && handleCardClick("all")}
                className={`cursor-pointer transition-all hover:shadow-md select-none border ${
                  activeCard === "all"
                    ? "ring-2 ring-primary border-primary bg-primary/5 shadow-sm"
                    : "hover:border-primary/50"
                }`}
              >
                <CardHeader className="pb-1 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-semibold text-muted-foreground">
                      Total Users
                    </CardTitle>
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-2xl font-bold tracking-tight">
                    {stats.counts.users}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {activeCard === "all" ? "✓ Filter Active" : "All Accounts"}
                  </p>
                </CardContent>
              </Card>

              {/* Card 2: Total Hostels */}
              <Card
                role="button"
                tabIndex={0}
                onClick={() => handleCardClick("hostels")}
                onKeyDown={(e) => e.key === "Enter" && handleCardClick("hostels")}
                className={`cursor-pointer transition-all hover:shadow-md select-none border ${
                  activeCard === "hostels"
                    ? "ring-2 ring-primary border-primary bg-primary/5 shadow-sm"
                    : "hover:border-primary/50"
                }`}
              >
                <CardHeader className="pb-1 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-semibold text-muted-foreground">
                      Total Hostels
                    </CardTitle>
                    <Building2 className="w-4 h-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-2xl font-bold tracking-tight">
                    {stats.counts.hostels}
                  </div>
                  <p className="text-[11px] text-primary hover:underline mt-0.5">
                    View 4 Hostels ↗
                  </p>
                </CardContent>
              </Card>

              {/* Card 3: Total Rooms */}
              <Card
                role="button"
                tabIndex={0}
                onClick={() => handleCardClick("rooms")}
                onKeyDown={(e) => e.key === "Enter" && handleCardClick("rooms")}
                className={`cursor-pointer transition-all hover:shadow-md select-none border ${
                  activeCard === "rooms"
                    ? "ring-2 ring-primary border-primary bg-primary/5 shadow-sm"
                    : "hover:border-primary/50"
                }`}
              >
                <CardHeader className="pb-1 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-semibold text-muted-foreground">
                      Total Rooms
                    </CardTitle>
                    <DoorOpen className="w-4 h-4 text-primary" />
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-2xl font-bold tracking-tight">
                    {stats.counts.rooms}
                  </div>
                  <p className="text-[11px] text-primary hover:underline mt-0.5">
                    {stats.counts.occupancyRate !== undefined
                      ? `${stats.counts.occupancyRate}% Occupied ↗`
                      : "Inspect Occupancy ↗"}
                  </p>
                </CardContent>
              </Card>

              {/* Card 4: Admins */}
              <Card
                role="button"
                tabIndex={0}
                onClick={() => handleCardClick("admin")}
                onKeyDown={(e) => e.key === "Enter" && handleCardClick("admin")}
                className={`cursor-pointer transition-all hover:shadow-md select-none border ${
                  activeCard === "admin"
                    ? "ring-2 ring-primary border-primary bg-primary/5 shadow-sm"
                    : "hover:border-primary/50"
                }`}
              >
                <CardHeader className="pb-1 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-semibold text-muted-foreground">
                      Admins
                    </CardTitle>
                    <Shield className="w-4 h-4 text-blue-500" />
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                    {stats.counts.admins ?? 0}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {activeCard === "admin" ? "✓ Filter Active" : "Filter Admins"}
                  </p>
                </CardContent>
              </Card>

              {/* Card 5: Wardens */}
              <Card
                role="button"
                tabIndex={0}
                onClick={() => handleCardClick("warden")}
                onKeyDown={(e) => e.key === "Enter" && handleCardClick("warden")}
                className={`cursor-pointer transition-all hover:shadow-md select-none border ${
                  activeCard === "warden"
                    ? "ring-2 ring-primary border-primary bg-primary/5 shadow-sm"
                    : "hover:border-primary/50"
                }`}
              >
                <CardHeader className="pb-1 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-semibold text-muted-foreground">
                      Wardens
                    </CardTitle>
                    <Shield className="w-4 h-4 text-emerald-500" />
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                    {stats.counts.wardens ?? 0}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {activeCard === "warden" ? "✓ Filter Active" : "Filter Wardens"}
                  </p>
                </CardContent>
              </Card>

              {/* Card 6: Security */}
              <Card
                role="button"
                tabIndex={0}
                onClick={() => handleCardClick("security")}
                onKeyDown={(e) => e.key === "Enter" && handleCardClick("security")}
                className={`cursor-pointer transition-all hover:shadow-md select-none border ${
                  activeCard === "security"
                    ? "ring-2 ring-primary border-primary bg-primary/5 shadow-sm"
                    : "hover:border-primary/50"
                }`}
              >
                <CardHeader className="pb-1 pt-4 px-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-xs font-semibold text-muted-foreground">
                      Security
                    </CardTitle>
                    <ShieldAlert className="w-4 h-4 text-amber-500" />
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                    {stats.counts.security ?? 0}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {activeCard === "security" ? "✓ Filter Active" : "Filter Gate Staff"}
                  </p>
                </CardContent>
              </Card>
            </div>
          </section>
        )}

        {/* 3. WORKING NAVIGATION LINKS (Cross-Domain Oversight Hub) */}
        <section aria-label="Super Admin Oversight Hub" className="mb-8">
          <Card className="border shadow-sm">
            <CardHeader className="pb-3 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center space-x-2">
                <SlidersHorizontal className="w-4 h-4 text-primary" />
                <span>Super Admin Quick Operations Hub</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/admin/dashboard")}
                  className="flex items-center justify-start space-x-2 h-10 px-3"
                >
                  <Building2 className="w-4 h-4 text-blue-500 shrink-0" />
                  <span className="truncate text-xs font-medium">Admin Portal</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/admin/dashboard?tab=pending")}
                  className="flex items-center justify-start space-x-2 h-10 px-3"
                >
                  <UserCheck className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="truncate text-xs font-medium">Pending Approvals</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/admin/rooms")}
                  className="flex items-center justify-start space-x-2 h-10 px-3"
                >
                  <DoorOpen className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="truncate text-xs font-medium">Rooms & Allocations</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/admin/complaints")}
                  className="flex items-center justify-start space-x-2 h-10 px-3"
                >
                  <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                  <span className="truncate text-xs font-medium">Complaints</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/outpass/admin/all")}
                  className="flex items-center justify-start space-x-2 h-10 px-3"
                >
                  <QrCode className="w-4 h-4 text-purple-500 shrink-0" />
                  <span className="truncate text-xs font-medium">Outpass Requests</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/mess-menu")}
                  className="flex items-center justify-start space-x-2 h-10 px-3"
                >
                  <Utensils className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="truncate text-xs font-medium">Mess Menus</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/notice-board")}
                  className="flex items-center justify-start space-x-2 h-10 px-3"
                >
                  <Bell className="w-4 h-4 text-cyan-500 shrink-0" />
                  <span className="truncate text-xs font-medium">Notice Board</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 2. USER MANAGEMENT SECTION (Filter, Search, Table, Actions, Pagination) */}
        <section aria-label="User Management Table" className="space-y-4">
          <Card className="border shadow-sm">
            <CardHeader className="pb-3 pt-5 px-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center space-x-2">
                    <Users className="w-5 h-5 text-primary" />
                    <span>Authorized User Accounts</span>
                    <Badge variant="secondary" className="ml-2 font-semibold">
                      {totalUsers} {totalUsers === 1 ? "Account" : "Accounts"}
                    </Badge>
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Super Admin role authority: Edit staff roles, assign wardens to hostels, inspect account details, and safely manage credentials.
                  </p>
                </div>

                {/* Filter and Clear Selection toolbar */}
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearSelection}
                    className="text-xs h-9"
                  >
                    <X className="w-3.5 h-3.5 mr-1" />
                    Clear Filters
                  </Button>
                </div>
              </div>

              {/* Search & Filters Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t mt-4">
                {/* Search Input */}
                <form onSubmit={handleSearchSubmit} className="relative">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                  <Input
                    placeholder="Search name, email, PRN..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </form>

                {/* Role Filter */}
                <div>
                  <Select value={roleFilter} onValueChange={handleRoleChange}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="All Roles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="warden">Warden</SelectItem>
                      <SelectItem value="security">Security</SelectItem>
                      <SelectItem value="student">Student</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div>
                  <Select value={statusFilter} onValueChange={handleStatusChange}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Hostel Filter */}
                <div>
                  <Select value={hostelFilter} onValueChange={handleHostelChange}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="All Hostels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Hostels</SelectItem>
                      {HOSTEL_OPTIONS.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>

            <CardContent className="px-6 pb-6 pt-2">
              {tableLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
                  <p className="text-xs text-muted-foreground">Loading authorized users from MongoDB...</p>
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-12 border rounded-lg bg-muted/20">
                  <Users className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="text-sm font-semibold">No users match the criteria</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Try adjusting your search terms or clearing current filters.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearSelection}
                    className="mt-4 text-xs"
                  >
                    Reset All Filters
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto border rounded-lg">
                  <Table className="w-full text-xs">
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="font-semibold">User / Email</TableHead>
                        <TableHead className="font-semibold">PRN</TableHead>
                        <TableHead className="font-semibold">Role</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold">Assigned Hostel</TableHead>
                        <TableHead className="font-semibold">Room</TableHead>
                        <TableHead className="text-right font-semibold pr-4">Authorized Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => {
                        const isSelf = u._id === user?._id;
                        const isProtected =
                          u.role === "super_admin" ||
                          u.email === "superadmin000@example.com" ||
                          u.email === "admin000@example.com" ||
                          u.email === "superadmin@siu.edu.in" ||
                          u.email === "admin@symbiosis.ac.in";

                        return (
                          <TableRow key={u._id} className="hover:bg-muted/30">
                            {/* Name & Email */}
                            <TableCell className="py-3">
                              <div className="font-medium text-foreground">
                                {u.firstName} {u.lastName}
                                {isSelf && (
                                  <Badge variant="outline" className="ml-2 text-[10px] py-0 border-primary text-primary">
                                    You
                                  </Badge>
                                )}
                              </div>
                              <div className="text-muted-foreground text-[11px] truncate max-w-[220px]">
                                {u.email}
                              </div>
                            </TableCell>

                            {/* PRN */}
                            <TableCell className="font-mono text-muted-foreground">
                              {u.prn || "—"}
                            </TableCell>

                            {/* Role */}
                            <TableCell>
                              <Badge
                                variant={
                                  u.role === "super_admin"
                                    ? "destructive"
                                    : u.role === "admin"
                                    ? "default"
                                    : u.role === "warden"
                                    ? "outline"
                                    : u.role === "security"
                                    ? "secondary"
                                    : "outline"
                                }
                                className="uppercase text-[10px] tracking-wider font-semibold"
                              >
                                {u.role.replace("_", " ")}
                              </Badge>
                            </TableCell>

                            {/* Status */}
                            <TableCell>
                              <Badge
                                variant={
                                  u.status === "approved"
                                    ? "default"
                                    : u.status === "pending"
                                    ? "secondary"
                                    : "destructive"
                                }
                                className="capitalize text-[10px]"
                              >
                                {u.status}
                              </Badge>
                            </TableCell>

                            {/* Hostel */}
                            <TableCell className="font-medium text-foreground">
                              {u.hostel || <span className="text-muted-foreground">—</span>}
                            </TableCell>

                            {/* Room */}
                            <TableCell className="text-muted-foreground">
                              {u.roomNumber ? `Room ${u.roomNumber}` : "—"}
                            </TableCell>

                            {/* Actions */}
                            <TableCell className="text-right pr-4">
                              <div className="flex items-center justify-end space-x-1.5">
                                {/* View Account Details */}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openDetailModal(u)}
                                  className="h-8 w-8 p-0"
                                  title="View Account Details"
                                >
                                  <Eye className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                                </Button>

                                {/* Edit Role */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditRoleModal(u)}
                                  className="h-8 px-2.5 text-xs flex items-center space-x-1"
                                  title="Edit Role and Hostel Assignment"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </Button>

                                {/* Delete (Protected for root accounts & self) */}
                                {!isSelf && !isProtected ? (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => openDeleteModal(u)}
                                    className="h-8 w-8 p-0"
                                    title="Delete Account"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                ) : (
                                  <span
                                    className="text-[10px] text-muted-foreground italic px-2 py-1"
                                    title={isSelf ? "Current session" : "Protected root account"}
                                  >
                                    Protected
                                  </span>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pagination Controls */}
              {totalUsers > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mt-4 pt-3 border-t">
                  <div className="text-xs text-muted-foreground">
                    Showing {(page - 1) * limit + 1} to{" "}
                    {Math.min(page * limit, totalUsers)} of {totalUsers} accounts
                  </div>

                  <div className="flex items-center space-x-2">
                    <Select
                      value={limit.toString()}
                      onValueChange={(val) => {
                        const newLimit = parseInt(val, 10);
                        setLimit(newLimit);
                        setPage(1);
                        fetchUsers(1, roleFilter, statusFilter, searchQuery, hostelFilter, newLimit);
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs w-[110px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 per page</SelectItem>
                        <SelectItem value="25">25 per page</SelectItem>
                        <SelectItem value="50">50 per page</SelectItem>
                      </SelectContent>
                    </Select>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page - 1)}
                      disabled={page <= 1}
                      className="h-8 px-2 text-xs"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      Prev
                    </Button>

                    <span className="text-xs font-medium px-2">
                      Page {page} of {totalPages}
                    </span>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(page + 1)}
                      disabled={page >= totalPages}
                      className="h-8 px-2 text-xs"
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* MODAL 1: EDIT ROLE & HOSTEL ASSIGNMENT */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Edit className="w-5 h-5 text-primary" />
                <span>Edit Account Role & Assignment</span>
              </DialogTitle>
              <DialogDescription>
                Assign authorized system role and relevant hostel jurisdiction. Super Admin privileges allow assigning Wardens, Admins, Security, and Students.
              </DialogDescription>
            </DialogHeader>

            {editUser && (
              <form onSubmit={handleSaveRole} className="space-y-4 py-2">
                <div className="bg-muted/40 p-3 rounded-lg space-y-1 text-xs">
                  <div className="font-semibold text-foreground text-sm">
                    {editUser.firstName} {editUser.lastName}
                  </div>
                  <div className="text-muted-foreground">{editUser.email}</div>
                  <div className="flex items-center space-x-2 pt-1">
                    <span className="text-muted-foreground">Current Role:</span>
                    <Badge variant="outline" className="text-[10px] uppercase font-semibold">
                      {editUser.role}
                    </Badge>
                    <span className="text-muted-foreground ml-2">Current Hostel:</span>
                    <span className="font-medium">{editUser.hostel || "None"}</span>
                  </div>
                </div>

                {/* Role Selector */}
                <div className="space-y-1.5">
                  <Label htmlFor="role-select" className="text-xs font-semibold">
                    Target Role
                  </Label>
                  <Select value={editRole} onValueChange={setEditRole}>
                    <SelectTrigger id="role-select" className="h-9 text-xs">
                      <SelectValue placeholder="Select Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="super_admin">Super Administrator (Root Authority)</SelectItem>
                      <SelectItem value="admin">Administrator (Campus-Wide Admin)</SelectItem>
                      <SelectItem value="warden">Warden (Hostel-Specific Admin)</SelectItem>
                      <SelectItem value="security">Security Personnel (Gate Operations)</SelectItem>
                      <SelectItem value="student">Student Account</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Hostel Assignment Selector */}
                <div className="space-y-1.5">
                  <Label htmlFor="hostel-select" className="text-xs font-semibold">
                    Hostel Assignment {editRole === "warden" ? "(Required for Wardens)" : "(Optional)"}
                  </Label>
                  <Select value={editHostel || "none"} onValueChange={(val) => setEditHostel(val)}>
                    <SelectTrigger id="hostel-select" className="h-9 text-xs">
                      <SelectValue placeholder="Select Assigned Hostel" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None / All Hostels (Campus-Wide)</SelectItem>
                      {HOSTEL_OPTIONS.map((hostelName) => (
                        <SelectItem key={hostelName} value={hostelName}>
                          {hostelName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Wardens will have their operational scope restricted to their assigned hostel.
                  </p>
                </div>

                <DialogFooter className="pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditOpen(false)}
                    disabled={isSavingRole}
                    className="h-9 text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSavingRole}
                    className="h-9 text-xs font-semibold"
                  >
                    {isSavingRole ? "Saving Changes..." : "Save Role & Hostel"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* MODAL 2: DELETE CONFIRMATION DIALOG */}
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2 text-destructive">
                <Trash2 className="w-5 h-5" />
                <span>Confirm Account Deletion</span>
              </DialogTitle>
              <DialogDescription>
                This action is irreversible. All related bookings and allocations for this user will be cleaned up.
              </DialogDescription>
            </DialogHeader>

            {deleteTarget && (
              <div className="py-2 space-y-3">
                <div className="bg-destructive/10 border border-destructive/20 p-3 rounded-lg text-xs space-y-1">
                  <div className="font-semibold text-foreground">
                    {deleteTarget.firstName} {deleteTarget.lastName}
                  </div>
                  <div className="text-muted-foreground">{deleteTarget.email}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Role: <span className="font-semibold uppercase">{deleteTarget.role}</span> | Status:{" "}
                    <span className="font-semibold capitalize">{deleteTarget.status}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Are you certain you want to permanently delete this user account from MongoDB?
                </p>
              </div>
            )}

            <DialogFooter className="pt-3 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDeleteOpen(false)}
                disabled={isDeleting}
                className="h-9 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="h-9 text-xs font-semibold"
              >
                {isDeleting ? "Deleting..." : "Permanently Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL 3: ACCOUNT DETAIL VIEW */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Eye className="w-5 h-5 text-primary" />
                <span>User Account Details</span>
              </DialogTitle>
              <DialogDescription>
                Complete profile and enrollment details stored in the database.
              </DialogDescription>
            </DialogHeader>

            {detailUser && (
              <div className="space-y-4 py-2 text-xs">
                <div className="grid grid-cols-2 gap-3 bg-muted/40 p-4 rounded-lg">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Full Name</span>
                    <span className="font-semibold text-sm">
                      {detailUser.firstName} {detailUser.lastName}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Email</span>
                    <span className="font-medium text-foreground">{detailUser.email}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">PRN</span>
                    <span className="font-mono font-medium">{detailUser.prn || "Not Applicable"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Phone</span>
                    <span className="font-medium">{detailUser.phone || "Not Provided"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Role</span>
                    <Badge variant="outline" className="uppercase font-semibold text-[10px] mt-0.5">
                      {detailUser.role}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Account Status</span>
                    <Badge
                      variant={
                        detailUser.status === "approved"
                          ? "default"
                          : detailUser.status === "pending"
                          ? "secondary"
                          : "destructive"
                      }
                      className="capitalize text-[10px] mt-0.5"
                    >
                      {detailUser.status}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Assigned Hostel</span>
                    <span className="font-medium">{detailUser.hostel || "Campus Wide"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Room Number</span>
                    <span className="font-medium">
                      {detailUser.roomNumber
                        ? `Floor ${detailUser.floor || 1}, Room ${detailUser.roomNumber}`
                        : "No Room Assigned"}
                    </span>
                  </div>
                  <div className="col-span-2 pt-2 border-t mt-1">
                    <span className="text-muted-foreground block text-[11px]">Created Date</span>
                    <span className="font-medium">
                      {new Date(detailUser.createdAt).toLocaleString()}
                    </span>
                  </div>
                </div>

                <DialogFooter className="pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsDetailOpen(false);
                      openEditRoleModal(detailUser);
                    }}
                    className="text-xs h-9"
                  >
                    <Edit className="w-3.5 h-3.5 mr-1" />
                    Edit Role / Hostel
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => setIsDetailOpen(false)}
                    className="text-xs h-9"
                  >
                    Close
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* MODAL 4: TOTAL HOSTELS BREAKDOWN (Opened by Card 2) */}
        <Dialog open={isHostelsModalOpen} onOpenChange={setIsHostelsModalOpen}>
          <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-primary" />
                <span>Symbiosis 4-Hostels Operational Overview</span>
              </DialogTitle>
              <DialogDescription>
                Live database breakdown of all 4 hostels, room allocations, occupancy, and outpass activity.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {stats?.hostelsBreakdown && stats.hostelsBreakdown.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {stats.hostelsBreakdown.map((h) => (
                    <Card key={h.name} className="border bg-card/60 shadow-sm">
                      <CardHeader className="pb-2 pt-4 px-4 border-b">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-bold text-foreground">
                            {h.name}
                          </CardTitle>
                          <Badge variant="outline" className="text-[10px]">
                            {h.location}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="px-4 py-3 space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total Capacity:</span>
                          <span className="font-semibold">{h.totalCapacity} beds</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Occupied Beds:</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {h.occupiedBeds} ({h.occupancyPercentage}%)
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Available Beds:</span>
                          <span className="font-semibold">{h.availableBeds} beds</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Rooms Status:</span>
                          <span>
                            {h.fullRooms} Full / {h.availableRooms} Available (Total {h.totalRooms})
                          </span>
                        </div>
                        <div className="flex justify-between pt-1 border-t">
                          <span className="text-muted-foreground">Approved Students:</span>
                          <span className="font-medium">{h.students}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Currently Out (Gate):</span>
                          <span className="font-medium text-amber-600 dark:text-amber-400">
                            {h.currentlyOut}
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2 mt-2">
                          <div
                            className="bg-primary rounded-full h-2 transition-all"
                            style={{ width: `${Math.min(h.occupancyPercentage, 100)}%` }}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-xs">
                  Loading 4-hostel breakdown...
                </div>
              )}
            </div>

            <DialogFooter className="pt-3 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setIsHostelsModalOpen(false);
                  navigate("/admin/rooms");
                }}
                className="text-xs h-9"
              >
                Manage Room Allocations ↗
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsHostelsModalOpen(false)}
                className="text-xs h-9"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* MODAL 5: TOTAL ROOMS OVERVIEW (Opened by Card 3) */}
        <Dialog open={isRoomsModalOpen} onOpenChange={setIsRoomsModalOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <DoorOpen className="w-5 h-5 text-primary" />
                <span>Hostel Rooms & Bed Occupancy Audit</span>
              </DialogTitle>
              <DialogDescription>
                System-wide room metrics across all residential buildings.
              </DialogDescription>
            </DialogHeader>

            {stats && (
              <div className="space-y-4 py-2 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-muted/40 p-4 rounded-lg">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Total Rooms</span>
                    <span className="font-bold text-lg">{stats.counts.rooms}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Occupied Rooms</span>
                    <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                      {stats.counts.occupiedRooms ?? 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Available Rooms</span>
                    <span className="font-bold text-lg text-blue-600 dark:text-blue-400">
                      {stats.counts.availableRooms ?? 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Total Bed Capacity</span>
                    <span className="font-bold text-lg">{stats.counts.totalCapacity ?? "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Occupied Beds</span>
                    <span className="font-bold text-lg text-emerald-600 dark:text-emerald-400">
                      {stats.counts.occupiedBeds ?? "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Occupancy Rate</span>
                    <span className="font-bold text-lg text-primary">
                      {stats.counts.occupancyRate ?? 0}%
                    </span>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  To view room-by-room floor plans, student allocations, or reassign beds, proceed to the full Rooms Management module.
                </div>

                <DialogFooter className="pt-3 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setIsRoomsModalOpen(false);
                      navigate("/admin/rooms");
                    }}
                    className="text-xs h-9"
                  >
                    Open Rooms Management ↗
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setIsRoomsModalOpen(false)}
                    className="text-xs h-9"
                  >
                    Close
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default SuperAdminDashboard;