import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Navigation } from "@/components/ui/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Users,
  Building2,
  DoorOpen,
  CheckCircle,
  AlertCircle,
  Loader2,
  Bell,
  Shield,
  QrCode,
  Utensils,
  Bus,
  Search,
  RefreshCw,
  Plus,
  Trash2,
  Printer,
  Calendar,
  MapPin,
  BarChart3,
  UserCheck,
  TrendingUp,
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

interface DashboardStats {
  selectedHostel: string;
  hostelsBreakdown: HostelBreakdown[];
  counts: {
    users: number;
    students: number;
    hostels: number;
    rooms: number;
    totalCapacity: number;
    occupiedBeds: number;
    availableBeds: number;
    occupancyRate: number;
    occupiedRooms: number;
    availableRooms: number;
    bookings: number;
    complaints: number;
    pendingStudents: number;
    activeOutpasses: number;
    currentlyOut: number;
    overdue: number;
  };
  bookingStats: {
    confirmed: number;
    cancelled: number;
    completed: number;
  };
  recentBookings: Array<{
    _id: string;
    user: {
      firstName: string;
      lastName: string;
      email: string;
      prn?: string;
    };
    room: {
      roomNumber: string;
      type: string;
      floor?: number;
    };
    hostel: {
      name: string;
    };
    bookingStatus: string;
    createdAt: string;
  }>;
}

interface RoomRecord {
  id: string;
  roomNumber: string;
  floor: number;
  capacity: number;
  occupantCount: number;
  availableSpots: number;
  isFull: boolean;
  status: string;
  occupants: Array<{
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    prn?: string;
    role: string;
  }>;
}

interface RoomsByHostel {
  hostel: {
    id: string;
    name: string;
    location?: string;
    floors?: number;
  };
  counts: {
    total: number;
    occupied: number;
    available: number;
    totalCapacity?: number;
    occupiedBeds?: number;
    availableBeds?: number;
    occupancyPercentage?: number;
  };
  rooms: RoomRecord[];
}

interface GateMovement {
  id: string;
  passCode: string;
  studentName: string;
  prn: string;
  hostel: string;
  roomNumber?: string;
  destination: string;
  date: string;
  outTime: string;
  expectedReturn: string;
  returnTime: string;
  status: 'CURRENTLY OUT' | 'RETURNED' | 'OVERDUE';
  verifiedBy: string;
}

interface GateAttendanceData {
  summary: {
    totalStudents: number;
    onCampus: number;
    currentlyOut: number;
    returned: number;
    overdue: number;
    approvedLeave: number;
    pendingRequests: number;
  };
  movements: GateMovement[];
}

interface AdminUserRecord {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  prn?: string;
  phone?: string;
  hostel?: string;
  roomNumber?: string;
  status?: string;
  createdAt: string;
  roomLocked?: boolean;
}

interface AdminOutpassRecord {
  _id: string;
  passCode?: string;
  student?: {
    _id?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    prn?: string;
    phone?: string;
    hostel?: string;
    roomNumber?: string;
  };
  reason?: string;
  destination?: string;
  status: string;
  outDate?: string;
  inDate?: string;
  actualOutTime?: string;
  actualInTime?: string;
  createdAt: string;
  adminRemarks?: string;
}

interface NoticeRecord {
  _id: string;
  title: string;
  description: string;
  imageUrl?: string;
  createdAt: string;
  uploadedBy?: { _id?: string; firstName?: string; lastName?: string; email?: string } | string;
}

interface MessMenuRecord {
  _id: string;
  day: string;
  mealType: string;
  items: string[];
  weekStartDate?: string;
}

interface BusRouteRecord {
  _id: string;
  routeName: string;
  stops: string[];
  timings: string[];
  active: boolean;
}

const ALL_HOSTELS_LIST = [
  'Voila Hostel',
  'Orchid Hostel',
  'Magnolia Hostel',
  'Symbiosis Royal Hostel',
];

export const AdminDashboard: React.FC<{ defaultTab?: string }> = ({ defaultTab }) => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab & Hostel Filters from URL
  const [activeTab, setActiveTab] = useState<string>(() => {
    return searchParams.get('tab') || defaultTab || 'overview';
  });
  const [selectedHostel, setSelectedHostel] = useState<string>(() => {
    return searchParams.get('hostel') || 'all';
  });

  const { toast } = useToast();

  // Core Data States
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [roomsByHostel, setRoomsByHostel] = useState<RoomsByHostel[]>([]);
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [pendingStudents, setPendingStudents] = useState<AdminUserRecord[]>([]);
  const [adminOutpasses, setAdminOutpasses] = useState<AdminOutpassRecord[]>([]);
  const [outpassStatusFilter, setOutpassStatusFilter] = useState('all');
  const [outpassSearch, setOutpassSearch] = useState('');
  const [gateAttendance, setGateAttendance] = useState<GateAttendanceData | null>(null);
  const [gateFilterStatus, setGateFilterStatus] = useState('all');
  const [gateSearchPRN, setGateSearchPRN] = useState('');
  const [notices, setNotices] = useState<NoticeRecord[]>([]);
  const [messMenus, setMessMenus] = useState<MessMenuRecord[]>([]);
  const [selectedMessDay, setSelectedMessDay] = useState('monday');
  const [busRoutes, setBusRoutes] = useState<BusRouteRecord[]>([]);

  // Loading States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isSearchingStudent, setIsSearchingStudent] = useState(false);

  // Student PRN Search (Central Quick Action)
  const [searchPRN, setSearchPRN] = useState('');
  const [searchedStudent, setSearchedStudent] = useState<AdminUserRecord | null>(null);

  // Modals State
  // 1. Room Allocation Dialog
  const [selectedStudentForAllocation, setSelectedStudentForAllocation] = useState<AdminUserRecord | null>(null);
  const [allocationHostel, setAllocationHostel] = useState('');
  const [allocationFloor, setAllocationFloor] = useState('1');
  const [allocationRoomNumber, setAllocationRoomNumber] = useState('');
  const [isAllocationDialogOpen, setIsAllocationDialogOpen] = useState(false);
  const [isAllocating, setIsAllocating] = useState(false);

  // 2. Reject Student Registration Dialog
  const [selectedStudentForReject, setSelectedStudentForReject] = useState<AdminUserRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);

  // 3. Outpass Review & Decision Dialog
  const [selectedOutpass, setSelectedOutpass] = useState<AdminOutpassRecord | null>(null);
  const [isOutpassReviewOpen, setIsOutpassReviewOpen] = useState(false);
  const [outpassAdminRemarks, setOutpassAdminRemarks] = useState('');
  const [isOutpassRejectReasonOpen, setIsOutpassRejectReasonOpen] = useState(false);
  const [outpassRejectReason, setOutpassRejectReason] = useState('');

  // 4. Add Room Occupant Dialog
  const [selectedRoomForOccupant, setSelectedRoomForOccupant] = useState<RoomRecord | null>(null);
  const [newOccupantUserId, setNewOccupantUserId] = useState('');
  const [isAddOccupantOpen, setIsAddOccupantOpen] = useState(false);

  // 5. Create Notice Dialog
  const [isCreateNoticeOpen, setIsCreateNoticeOpen] = useState(false);
  const [newNoticeTitle, setNewNoticeTitle] = useState('');
  const [newNoticeDesc, setNewNoticeDesc] = useState('');
  const [newNoticeImage, setNewNoticeImage] = useState('');

  // 6. Edit Mess Menu Dialog
  const [isEditMessOpen, setIsEditMessOpen] = useState(false);
  const [editMealType, setEditMealType] = useState('breakfast');
  const [editMealItemsText, setEditMealItemsText] = useState('');

  // 7. Add Bus Route Dialog
  const [isAddRouteOpen, setIsAddRouteOpen] = useState(false);
  const [newRouteName, setNewRouteName] = useState('');
  const [newRouteStops, setNewRouteStops] = useState('');
  const [newRouteTimings, setNewRouteTimings] = useState('');

  // Synchronize Tab & Hostel to URL
  const updateUrlParams = (tab: string, hostel: string) => {
    const params = new URLSearchParams();
    if (tab) params.set('tab', tab);
    if (hostel && hostel !== 'all') params.set('hostel', hostel);
    setSearchParams(params);
  };

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    updateUrlParams(val, selectedHostel);
  };

  const handleHostelChange = (hostelName: string) => {
    setSelectedHostel(hostelName);
    updateUrlParams(activeTab, hostelName);
  };

  // Sync tab & hostel when URL query params change (e.g. via navigation links)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
    const hostelParam = searchParams.get('hostel');
    if (hostelParam && hostelParam !== selectedHostel) {
      setSelectedHostel(hostelParam);
    }
  }, [searchParams, activeTab, selectedHostel]);

  // Primary Fetch Function
  const fetchAllData = useCallback(async (hostelFilter = selectedHostel, showToast = false) => {
    try {
      setRefreshing(true);
      const queryHostel = hostelFilter !== 'all' ? `?hostel=${encodeURIComponent(hostelFilter)}` : '';

      // 1. Fetch Dashboard Stats
      const statsRes = await authenticatedFetch(`${API_ENDPOINTS.ADMIN_DASHBOARD}${queryHostel}`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.data);
      }

      // 2. Fetch Rooms & Occupancy
      const roomsRes = await authenticatedFetch(`${API_ENDPOINTS.ADMIN_ROOMS}${queryHostel}`);
      if (roomsRes.ok) {
        const roomsData = await roomsRes.json();
        setRoomsByHostel(roomsData.data || []);
      }

      // 3. Fetch Users
      const roleParam = userRoleFilter !== 'all' ? `&role=${userRoleFilter}` : '';
      const searchParam = userSearchTerm ? `&search=${encodeURIComponent(userSearchTerm)}` : '';
      const userHostelParam = hostelFilter !== 'all' ? `&hostel=${encodeURIComponent(hostelFilter)}` : '';
      const usersRes = await authenticatedFetch(
        `${API_ENDPOINTS.ADMIN_USERS}?page=${usersPage}&limit=20${userHostelParam}${roleParam}${searchParam}`
      );
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setUsers(usersData.data || []);
        setUsersTotal(usersData.total || 0);
      }

      // 4. Fetch Pending Students
      const pendingRes = await authenticatedFetch(`${API_ENDPOINTS.ADMIN_PENDING_STUDENTS}${queryHostel}`);
      if (pendingRes.ok) {
        const pendingData = await pendingRes.json();
        setPendingStudents(pendingData.data || []);
      }

      // 5. Fetch Outpasses
      const outpassHostelParam = hostelFilter !== 'all' ? `&hostel=${encodeURIComponent(hostelFilter)}` : '';
      const outpassRes = await authenticatedFetch(
        `${API_ENDPOINTS.ADMIN_OUTPASS_ALL}?limit=100${outpassHostelParam}`
      );
      if (outpassRes.ok) {
        const outpassData = await outpassRes.json();
        setAdminOutpasses(outpassData.data || []);
      }

      // 6. Fetch Gate Attendance
      const gateRes = await authenticatedFetch(`${API_ENDPOINTS.SECURITY_GATE_ATTENDANCE}${queryHostel}`);
      if (gateRes.ok) {
        const gateData = await gateRes.json();
        setGateAttendance(gateData.data || null);
      }

      // 7. Fetch Notices
      const noticesRes = await authenticatedFetch(API_ENDPOINTS.NOTICES_ALL);
      if (noticesRes.ok) {
        const noticesData = await noticesRes.json();
        setNotices(noticesData.data || []);
      }

      // 8. Fetch Mess Menu
      const messRes = await authenticatedFetch(API_ENDPOINTS.MESS_MENU_ALL);
      if (messRes.ok) {
        const messData = await messRes.json();
        setMessMenus(messData.data || []);
      }

      // 9. Fetch Bus Routes
      const busRes = await authenticatedFetch(API_ENDPOINTS.BUS_ROUTES_ALL);
      if (busRes.ok) {
        const busData = await busRes.json();
        setBusRoutes(busData.data || []);
      }

      if (showToast) {
        toast({
          title: "Dashboard Synchronized",
          description: `Loaded real operational records for ${hostelFilter === 'all' ? 'All Hostels' : hostelFilter}.`,
        });
      }
    } catch (err: unknown) {
      console.error("Error fetching admin dashboard data:", err);
      const message = err instanceof Error ? err.message : "Failed to load admin records from database.";
      toast({
        title: "Connection Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedHostel, userRoleFilter, userSearchTerm, usersPage, toast]);

  // Re-fetch when hostel or tab changes
  useEffect(() => {
    fetchAllData(selectedHostel);
  }, [selectedHostel, fetchAllData]);

  // Filtered Outpasses
  const filteredOutpasses = useMemo(() => {
    return adminOutpasses.filter(p => {
      const matchesStatus = outpassStatusFilter === 'all' || p.status === outpassStatusFilter;
      const studentName = p.student ? `${p.student.firstName || ''} ${p.student.lastName || ''}`.trim() : '';
      const matchesSearch = !outpassSearch.trim() || 
        studentName.toLowerCase().includes(outpassSearch.toLowerCase()) ||
        (p.student?.prn || '').toLowerCase().includes(outpassSearch.toLowerCase()) ||
        (p.passCode || '').toLowerCase().includes(outpassSearch.toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [adminOutpasses, outpassStatusFilter, outpassSearch]);

  // Filtered Gate Movements
  const filteredGateMovements = useMemo(() => {
    if (!gateAttendance?.movements) return [];
    return gateAttendance.movements.filter(m => {
      const matchesStatus =
        gateFilterStatus === 'all' ||
        (gateFilterStatus === 'currently_out' && m.status === 'CURRENTLY OUT') ||
        (gateFilterStatus === 'returned' && m.status === 'RETURNED') ||
        (gateFilterStatus === 'overdue' && m.status === 'OVERDUE');

      const matchesSearch =
        !gateSearchPRN.trim() ||
        (m.prn || '').toLowerCase().includes(gateSearchPRN.toLowerCase()) ||
        (m.studentName || '').toLowerCase().includes(gateSearchPRN.toLowerCase()) ||
        (m.passCode || '').toLowerCase().includes(gateSearchPRN.toLowerCase());

      return matchesStatus && matchesSearch;
    });
  }, [gateAttendance, gateFilterStatus, gateSearchPRN]);

  // Active Hostel Breakdown for card metrics
  const activeBreakdown = useMemo(() => {
    if (!stats?.hostelsBreakdown) return null;
    if (selectedHostel === 'all') return null;
    return stats.hostelsBreakdown.find(h => h.name === selectedHostel);
  }, [stats, selectedHostel]);

  // Auth Guard
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm">Authenticating session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    navigate('/admin/login');
    return null;
  }

  if (user.role !== 'admin' && user.role !== 'super_admin') {
    navigate('/dashboard');
    return null;
  }

  // --- ACTIONS ---

  // Search Student by PRN
  const handleSearchStudent = async () => {
    if (!searchPRN.trim()) {
      toast({ title: "PRN Required", description: "Please enter a student PRN", variant: "destructive" });
      return;
    }
    setIsSearchingStudent(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.ADMIN_SEARCH_STUDENT(searchPRN.trim()));
      const data = await res.json();
      if (res.ok && data.data) {
        setSearchedStudent(data.data);
      } else {
        toast({ title: "Not Found", description: data.message || "No student found with this PRN", variant: "destructive" });
        setSearchedStudent(null);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to search student";
      toast({ title: "Search Error", description: message, variant: "destructive" });
    } finally {
      setIsSearchingStudent(false);
    }
  };

  // Approve and Allocate Room
  const handleApproveAndAllocate = async () => {
    if (!selectedStudentForAllocation || !allocationHostel || !allocationRoomNumber) {
      toast({ title: "Missing Information", description: "Please specify hostel, floor, and room number.", variant: "destructive" });
      return;
    }
    setIsAllocating(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.ADMIN_APPROVE_STUDENT(selectedStudentForAllocation._id), {
        method: 'POST',
        body: JSON.stringify({
          hostelId: allocationHostel,
          floor: allocationFloor,
          roomNumber: allocationRoomNumber.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast({
          title: "Registration Approved",
          description: `Student allocated to ${data.data?.student?.hostel} Room ${data.data?.student?.roomNumber}.`,
        });
        setIsAllocationDialogOpen(false);
        setSelectedStudentForAllocation(null);
        fetchAllData(selectedHostel);
      } else {
        toast({ title: "Allocation Failed", description: data.message || "Failed to allocate room", variant: "destructive" });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to allocate room";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsAllocating(false);
    }
  };

  // Reject Student Registration
  const handleRejectStudent = async () => {
    if (!selectedStudentForReject) return;
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.ADMIN_REJECT_STUDENT(selectedStudentForReject._id), {
        method: 'POST',
        body: JSON.stringify({ reason: rejectionReason }),
      });
      if (res.ok) {
        toast({ title: "Registration Rejected", description: "Student registration has been declined." });
        setIsRejectDialogOpen(false);
        setSelectedStudentForReject(null);
        fetchAllData(selectedHostel);
      } else {
        const data = await res.json();
        toast({ title: "Error", description: data.message || "Failed to reject registration", variant: "destructive" });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to reject registration";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  // Approve Outpass
  const handleApproveOutpass = async () => {
    if (!selectedOutpass) return;
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.ADMIN_OUTPASS_APPROVE(selectedOutpass._id), {
        method: 'PUT',
        body: JSON.stringify({ adminRemarks: outpassAdminRemarks }),
      });
      if (res.ok) {
        toast({
          title: "Outpass Approved",
          description: "Digital pass code generated and approved for gate verification.",
        });
        setIsOutpassReviewOpen(false);
        setSelectedOutpass(null);
        setOutpassAdminRemarks('');
        fetchAllData(selectedHostel);
      } else {
        const data = await res.json();
        toast({ title: "Approval Failed", description: data.message, variant: "destructive" });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to reject registration";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  // Reject Outpass
  const handleRejectOutpass = async () => {
    if (!selectedOutpass) return;
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.ADMIN_OUTPASS_REJECT(selectedOutpass._id), {
        method: 'PUT',
        body: JSON.stringify({ rejectionReason: outpassRejectReason }),
      });
      if (res.ok) {
        toast({ title: "Outpass Rejected", description: "Outpass request has been rejected." });
        setIsOutpassRejectReasonOpen(false);
        setSelectedOutpass(null);
        setOutpassRejectReason('');
        fetchAllData(selectedHostel);
      } else {
        const data = await res.json();
        toast({ title: "Rejection Failed", description: data.message, variant: "destructive" });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to reject registration";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  // Create Notice
  const handleCreateNotice = async () => {
    if (!newNoticeTitle.trim() || !newNoticeDesc.trim()) {
      toast({ title: "Missing Fields", description: "Title and description are required", variant: "destructive" });
      return;
    }
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.NOTICES_CREATE, {
        method: 'POST',
        body: JSON.stringify({
          title: newNoticeTitle.trim(),
          description: newNoticeDesc.trim(),
          imageUrl: newNoticeImage.trim() || 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&q=80&w=1000',
        }),
      });
      if (res.ok) {
        toast({ title: "Notice Published", description: "Hostel notice is now live." });
        setIsCreateNoticeOpen(false);
        setNewNoticeTitle('');
        setNewNoticeDesc('');
        setNewNoticeImage('');
        fetchAllData(selectedHostel);
      } else {
        const data = await res.json();
        toast({ title: "Failed to Publish", description: data.message, variant: "destructive" });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to reject registration";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  // Delete Notice
  const handleDeleteNotice = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this notice?")) return;
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.NOTICES_DELETE(id), { method: 'DELETE' });
      if (res.ok) {
        toast({ title: "Notice Removed", description: "Notice deleted successfully." });
        fetchAllData(selectedHostel);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to reject registration";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  // Save Mess Menu
  const handleSaveMessMenu = async () => {
    try {
      const items = editMealItemsText
        .split('\n')
        .map(i => i.trim())
        .filter(i => i.length > 0);

      const res = await authenticatedFetch(API_ENDPOINTS.MESS_MENU_CREATE, {
        method: 'POST',
        body: JSON.stringify({
          day: selectedMessDay,
          mealType: editMealType,
          items,
        }),
      });
      if (res.ok) {
        toast({ title: "Mess Menu Updated", description: `${selectedMessDay.toUpperCase()} ${editMealType.toUpperCase()} items saved.` });
        setIsEditMessOpen(false);
        fetchAllData(selectedHostel);
      } else {
        const data = await res.json();
        toast({ title: "Failed to Update", description: data.message, variant: "destructive" });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to reject registration";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  // Create Bus Route
  const handleCreateBusRoute = async () => {
    if (!newRouteName.trim()) {
      toast({ title: "Route Name Required", variant: "destructive" });
      return;
    }
    try {
      const stops = newRouteStops.split(',').map(s => s.trim()).filter(Boolean);
      const timings = newRouteTimings.split(',').map(t => t.trim()).filter(Boolean);

      const res = await authenticatedFetch(API_ENDPOINTS.BUS_ROUTES_CREATE, {
        method: 'POST',
        body: JSON.stringify({
          routeName: newRouteName.trim(),
          stops: stops.length > 0 ? stops : ['Campus Gate', 'Lavale Circle'],
          timings: timings.length > 0 ? timings : ['08:00 AM', '05:00 PM'],
          active: true,
        }),
      });
      if (res.ok) {
        toast({ title: "Bus Route Created", description: "Transport schedule added successfully." });
        setIsAddRouteOpen(false);
        setNewRouteName('');
        setNewRouteStops('');
        setNewRouteTimings('');
        fetchAllData(selectedHostel);
      } else {
        const data = await res.json();
        toast({ title: "Failed to Add Route", description: data.message, variant: "destructive" });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to reject registration";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  // Delete Bus Route
  const handleDeleteBusRoute = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this bus route?")) return;
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.BUS_ROUTES_DELETE(id), { method: 'DELETE' });
      if (res.ok) {
        toast({ title: "Route Deleted", description: "Bus route deleted." });
        fetchAllData(selectedHostel);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to reject registration";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  // Delete User
  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to delete this user record?")) return;
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.ADMIN_USER_DELETE(userId), { method: 'DELETE' });
      if (res.ok) {
        toast({ title: "User Deleted", description: "User record removed from database." });
        fetchAllData(selectedHostel);
      } else {
        const data = await res.json();
        toast({ title: "Delete Failed", description: data.message, variant: "destructive" });
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "An error occurred";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 1. Exactly ONE shared Navigation bar (with logout) */}
      <Navigation />

      <main className="container mx-auto px-4 lg:px-6 py-6 space-y-6">
        {/* Top Header Banner */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-border/60">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight gradient-primary bg-clip-text text-transparent">
                Symbiosis HMS Central Operations
              </h1>
              <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold">
                {user.role === 'super_admin' ? 'Super Admin' : 'Admin Authority'}
              </Badge>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground mt-1">
              Hostel-wise student management, room allocations, leave authorizations, and verified gate activity
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAllData(selectedHostel, true)}
              disabled={refreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Refreshing...' : 'Sync Database'}</span>
            </Button>
          </div>
        </div>

        {/* SECTION 1: ALL FOUR HOSTEL CLICKABLE CARDS + ALL HOSTELS SELECTOR */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              <h2 className="text-base font-bold text-foreground">Select Hostel Facility</h2>
            </div>
            <span className="text-xs text-muted-foreground">
              Click any hostel card to load its authentic records & occupancy breakdown
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* "All Hostels" Card */}
            <Card
              onClick={() => handleHostelChange('all')}
              className={`cursor-pointer transition-all duration-200 border-2 ${
                selectedHostel === 'all'
                  ? 'border-primary ring-2 ring-primary/20 bg-primary/5 shadow-md'
                  : 'hover:border-primary/50 hover:bg-muted/40 shadow-sm'
              }`}
            >
              <CardContent className="p-4 flex flex-col justify-between h-full space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">System-Wide</span>
                    <h3 className="font-bold text-sm text-foreground">All Hostels</h3>
                  </div>
                  <Badge variant={selectedHostel === 'all' ? 'default' : 'secondary'} className="text-[10px]">
                    4 Facilities
                  </Badge>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Capacity:</span>
                    <span className="font-semibold">{stats?.counts.totalCapacity || 0} Beds</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Occupied:</span>
                    <span className="font-semibold text-emerald-600">{stats?.counts.occupiedBeds || 0} Beds</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">System Occupancy:</span>
                    <span className="font-bold text-primary">{stats?.counts.occupancyRate || 0}%</span>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, stats?.counts.occupancyRate || 0)}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Individual 4 Hostels */}
            {(stats?.hostelsBreakdown || ALL_HOSTELS_LIST.map(name => ({
              id: name,
              name,
              location: 'Campus',
              totalRooms: 0,
              fullRooms: 0,
              availableRooms: 0,
              totalCapacity: 0,
              occupiedBeds: 0,
              availableBeds: 0,
              occupancyPercentage: 0,
              students: 0,
              pendingStudents: 0,
              outpassCount: 0,
              currentlyOut: 0,
              overdue: 0,
            }))).map((h) => {
              const isSelected = selectedHostel === h.name;
              return (
                <Card
                  key={h.id || h.name}
                  onClick={() => handleHostelChange(h.name)}
                  className={`cursor-pointer transition-all duration-200 border-2 ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/20 bg-primary/5 shadow-md'
                      : 'hover:border-primary/50 hover:bg-muted/40 shadow-sm'
                  }`}
                >
                  <CardContent className="p-4 flex flex-col justify-between h-full space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {h.location || 'SIT Campus'}
                        </span>
                        <h3 className="font-bold text-sm text-foreground line-clamp-1">{h.name}</h3>
                      </div>
                      {isSelected && (
                        <Badge variant="default" className="text-[10px] h-5 px-1.5 bg-primary">
                          Active
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Capacity:</span>
                        <span className="font-semibold">{h.totalCapacity} Beds</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Occupied / Free:</span>
                        <span className="font-semibold">
                          <span className="text-emerald-600 font-bold">{h.occupiedBeds}</span> / {h.availableBeds}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Students (Active):</span>
                        <span className="font-semibold">{h.students} enrolled</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Currently Outside:</span>
                        <span className={`font-semibold ${h.currentlyOut > 0 ? 'text-amber-600' : ''}`}>
                          {h.currentlyOut} students
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">Occupancy Rate:</span>
                        <span className="font-bold text-foreground">{h.occupancyPercentage}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            h.occupancyPercentage > 85 ? 'bg-amber-500' : 'bg-primary'
                          }`}
                          style={{ width: `${Math.min(100, h.occupancyPercentage)}%` }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        {/* SECTION 2: FUNCTIONAL TABS */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full space-y-4">
          <div className="overflow-x-auto pb-1">
            <TabsList className="bg-muted/80 p-1 rounded-xl inline-flex w-auto min-w-full justify-start space-x-1">
              <TabsTrigger value="overview" className="flex items-center gap-1.5 text-xs py-1.5 px-3">
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Hostel Overview</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-1.5 text-xs py-1.5 px-3">
                <Users className="w-3.5 h-3.5" />
                <span>User Management</span>
              </TabsTrigger>
              <TabsTrigger value="rooms" className="flex items-center gap-1.5 text-xs py-1.5 px-3">
                <DoorOpen className="w-3.5 h-3.5" />
                <span>Rooms & Occupancy</span>
              </TabsTrigger>
              <TabsTrigger value="pending" className="flex items-center gap-1.5 text-xs py-1.5 px-3">
                <UserCheck className="w-3.5 h-3.5" />
                <span>Pending Approvals ({pendingStudents.length})</span>
              </TabsTrigger>
              <TabsTrigger value="outpasses" className="flex items-center gap-1.5 text-xs py-1.5 px-3">
                <QrCode className="w-3.5 h-3.5" />
                <span>Leave & Outpasses ({adminOutpasses.filter(p => p.status === 'pending').length})</span>
              </TabsTrigger>
              <TabsTrigger value="attendance" className="flex items-center gap-1.5 text-xs py-1.5 px-3">
                <Shield className="w-3.5 h-3.5" />
                <span>Attendance & Gate Activity</span>
              </TabsTrigger>
              <TabsTrigger value="notices" className="flex items-center gap-1.5 text-xs py-1.5 px-3">
                <Bell className="w-3.5 h-3.5" />
                <span>Notices & Rules</span>
              </TabsTrigger>
              <TabsTrigger value="mess" className="flex items-center gap-1.5 text-xs py-1.5 px-3">
                <Utensils className="w-3.5 h-3.5" />
                <span>Mess Menu</span>
              </TabsTrigger>
              <TabsTrigger value="buses" className="flex items-center gap-1.5 text-xs py-1.5 px-3">
                <Bus className="w-3.5 h-3.5" />
                <span>Bus Routes</span>
              </TabsTrigger>
              <TabsTrigger value="reports" className="flex items-center gap-1.5 text-xs py-1.5 px-3">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Operational Reports</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* TAB 1: HOSTEL OVERVIEW */}
          <TabsContent value="overview" className="space-y-6">
            {/* KPI Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
              <Card className="shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">Active Students</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-extrabold text-foreground">{stats?.counts.students || 0}</span>
                    <Users className="w-5 h-5 text-primary opacity-80" />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {selectedHostel === 'all' ? 'Across all 4 hostels' : `Enrolled in ${selectedHostel}`}
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">Total Capacity</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-extrabold text-foreground">{stats?.counts.totalCapacity || 0}</span>
                    <Building2 className="w-5 h-5 text-blue-500 opacity-80" />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {stats?.counts.rooms || 0} rooms configured
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">Occupied Beds</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-extrabold text-emerald-600">{stats?.counts.occupiedBeds || 0}</span>
                    <CheckCircle className="w-5 h-5 text-emerald-500 opacity-80" />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {stats?.counts.availableBeds || 0} beds available
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">Occupancy Rate</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-extrabold text-primary">{stats?.counts.occupancyRate || 0}%</span>
                    <BarChart3 className="w-5 h-5 text-primary opacity-80" />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {stats?.counts.occupiedRooms || 0} fully filled rooms
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">Currently Outside</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-2xl font-extrabold ${(stats?.counts.currentlyOut || 0) > 0 ? 'text-amber-600' : 'text-foreground'}`}>
                      {stats?.counts.currentlyOut || 0}
                    </span>
                    <QrCode className="w-5 h-5 text-amber-500 opacity-80" />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Verified gate exits
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">Overdue Returns</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-2xl font-extrabold ${(stats?.counts.overdue || 0) > 0 ? 'text-destructive' : 'text-foreground'}`}>
                      {stats?.counts.overdue || 0}
                    </span>
                    <AlertCircle className="w-5 h-5 text-destructive opacity-80" />
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Past expected return curfew
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Student Search by PRN Card */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Search className="w-4 h-4 text-primary" />
                  <span>Student PRN Record Lookup</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Inspect student residential assignment, verified contacts, and room change requests
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-3 max-w-lg">
                  <Input
                    placeholder="Enter student PRN (e.g. 24070123001)..."
                    value={searchPRN}
                    onChange={(e) => setSearchPRN(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchStudent()}
                    className="text-sm"
                  />
                  <Button onClick={handleSearchStudent} disabled={isSearchingStudent} className="gap-2">
                    {isSearchingStudent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    <span>Lookup</span>
                  </Button>
                </div>

                {searchedStudent && (
                  <div className="p-4 bg-muted/40 rounded-xl border border-border/70 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center">
                          {searchedStudent.name?.charAt(0) || 'S'}
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-foreground">{searchedStudent.name}</h4>
                          <p className="text-xs text-muted-foreground">PRN: {searchedStudent.prn} • {searchedStudent.email}</p>
                        </div>
                      </div>
                      <Badge variant={searchedStudent.roomLocked ? "default" : "outline"}>
                        {searchedStudent.roomLocked ? "Room Assigned" : "Unallocated"}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-muted-foreground">Hostel:</span>
                        <p className="font-semibold text-foreground capitalize">{searchedStudent.hostel || 'Unassigned'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Floor / Room:</span>
                        <p className="font-semibold text-foreground">
                          {searchedStudent.floor ? `Floor ${searchedStudent.floor}, Room ${searchedStudent.roomNumber}` : '—'}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Phone:</span>
                        <p className="font-semibold text-foreground">{searchedStudent.phone || '—'}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Registration Status:</span>
                        <p className="font-semibold text-foreground uppercase">{searchedStudent.status || 'Active'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Management Shortcuts */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card
                onClick={() => handleTabChange('notices')}
                className="cursor-pointer hover:border-primary/50 transition-all p-4 flex items-center gap-4 shadow-sm"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  <Bell className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Hostel Notices & Rules</h4>
                  <p className="text-xs text-muted-foreground">{notices.length} active announcements</p>
                </div>
              </Card>

              <Card
                onClick={() => handleTabChange('mess')}
                className="cursor-pointer hover:border-primary/50 transition-all p-4 flex items-center gap-4 shadow-sm"
              >
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                  <Utensils className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Weekly Mess Schedule</h4>
                  <p className="text-xs text-muted-foreground">Manage 7-day nutritional menu</p>
                </div>
              </Card>

              <Card
                onClick={() => handleTabChange('buses')}
                className="cursor-pointer hover:border-primary/50 transition-all p-4 flex items-center gap-4 shadow-sm"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
                  <Bus className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">Campus Bus & Shuttle</h4>
                  <p className="text-xs text-muted-foreground">{busRoutes.length} scheduled transport routes</p>
                </div>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 2: USER MANAGEMENT */}
          <TabsContent value="users" className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span>User Directory ({usersTotal} records)</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {selectedHostel === 'all'
                      ? 'System-wide accounts across all hostels'
                      : `Accounts associated with ${selectedHostel}`}
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative w-48">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder="Search name, PRN..."
                      value={userSearchTerm}
                      onChange={(e) => setUserSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && fetchAllData(selectedHostel)}
                      className="pl-8 text-xs h-8"
                    />
                  </div>

                  <Select
                    value={userRoleFilter}
                    onValueChange={(val) => {
                      setUserRoleFilter(val);
                      fetchAllData(selectedHostel);
                    }}
                  >
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="student">Students</SelectItem>
                      <SelectItem value="warden">Wardens</SelectItem>
                      <SelectItem value="security">Security</SelectItem>
                      <SelectItem value="admin">Admins</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button size="sm" variant="outline" onClick={() => fetchAllData(selectedHostel)} className="h-8 text-xs">
                    Apply Filter
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>PRN / Identifier</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Hostel & Room</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                            No user records found matching the current criteria.
                          </TableCell>
                        </TableRow>
                      ) : (
                        users.map((u) => (
                          <TableRow key={u._id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm text-foreground">
                                  {u.firstName} {u.lastName}
                                </p>
                                <p className="text-xs text-muted-foreground">{u.email}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs font-mono">{u.prn || 'N/A'}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  u.role === 'admin'
                                    ? 'destructive'
                                    : u.role === 'warden'
                                    ? 'default'
                                    : u.role === 'security'
                                    ? 'outline'
                                    : 'secondary'
                                }
                                className="text-[10px] uppercase"
                              >
                                {u.role}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {u.hostel ? (
                                <span>
                                  {u.hostel} {u.roomNumber ? `• Rm ${u.roomNumber}` : ''}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={u.status === 'approved' ? 'default' : 'secondary'}
                                className={`text-[10px] ${u.status === 'approved' ? 'bg-emerald-600' : ''}`}
                              >
                                {u.status || 'Active'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {u.role !== 'super_admin' && u._id !== user._id && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteUser(u._id)}
                                  className="text-destructive hover:text-destructive h-7 w-7 p-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: ROOMS & OCCUPANCY */}
          <TabsContent value="rooms" className="space-y-4">
            {roomsByHostel.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                <DoorOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No room configurations found for the selected view.</p>
              </Card>
            ) : (
              roomsByHostel.map((hostelBlock) => (
                <Card key={hostelBlock.hostel.id} className="shadow-sm mb-4">
                  <CardHeader className="pb-3 border-b border-border/50">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-primary" />
                          <span>{hostelBlock.hostel.name}</span>
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {hostelBlock.counts.total} rooms • {hostelBlock.counts.occupied} full • {hostelBlock.counts.available} available
                        </CardDescription>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Capacity: {hostelBlock.counts.totalCapacity || hostelBlock.counts.total * 3} beds
                        </Badge>
                        <Badge variant="default" className="text-xs bg-emerald-600">
                          Occupied: {hostelBlock.counts.occupiedBeds || 0}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {hostelBlock.rooms.slice(0, 32).map((rm) => (
                        <div
                          key={rm.id}
                          className={`p-3 rounded-xl border text-xs space-y-2 transition-all ${
                            rm.isFull
                              ? 'bg-muted/40 border-border/80'
                              : 'bg-card border-border hover:border-primary/40'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-sm text-foreground">Room {rm.roomNumber}</span>
                            <Badge
                              variant={rm.isFull ? "destructive" : "secondary"}
                              className="text-[10px]"
                            >
                              {rm.isFull ? "FULL" : `${rm.availableSpots} Free`}
                            </Badge>
                          </div>
                          <div className="flex justify-between text-muted-foreground text-[11px]">
                            <span>Floor {rm.floor}</span>
                            <span>{rm.occupantCount} / {rm.capacity} Beds</span>
                          </div>

                          {rm.occupants && rm.occupants.length > 0 && (
                            <div className="pt-1 border-t border-border/40 space-y-1">
                              {rm.occupants.map((occ) => (
                                <p key={occ._id} className="text-[10px] text-foreground font-medium truncate">
                                  • {occ.firstName} {occ.lastName} ({occ.prn || 'PRN N/A'})
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* TAB 4: PENDING STUDENT REGISTRATIONS & ROOM ALLOCATION */}
          <TabsContent value="pending" className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-primary" />
                    <span>Pending Student Approvals ({pendingStudents.length})</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Review incoming student registrations, verify credentials, and allocate room
                  </CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => fetchAllData(selectedHostel)}>
                  Refresh Queue
                </Button>
              </CardHeader>
              <CardContent>
                {pendingStudents.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground space-y-2">
                    <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
                    <p className="font-semibold text-foreground">No Pending Registrations</p>
                    <p className="text-xs">All registered students have been reviewed and allocated to rooms.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>PRN</TableHead>
                          <TableHead>Requested Hostel</TableHead>
                          <TableHead>Email & Phone</TableHead>
                          <TableHead>Registered</TableHead>
                          <TableHead className="text-right">Decision</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingStudents.map((st) => (
                          <TableRow key={st._id}>
                            <TableCell className="font-medium text-sm">
                              {st.firstName} {st.lastName}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{st.prn || 'N/A'}</TableCell>
                            <TableCell className="text-xs font-semibold text-primary">
                              {st.hostel || 'Any Available'}
                            </TableCell>
                            <TableCell className="text-xs">
                              <p>{st.email}</p>
                              <p className="text-muted-foreground">{st.phone || '—'}</p>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(st.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedStudentForAllocation(st);
                                  setAllocationHostel(roomsByHostel[0]?.hostel?.id || '');
                                  setAllocationFloor('1');
                                  setAllocationRoomNumber('101');
                                  setIsAllocationDialogOpen(true);
                                }}
                                className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                              >
                                Allocate Room
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedStudentForReject(st);
                                  setIsRejectDialogOpen(true);
                                }}
                                className="h-7 text-xs text-destructive hover:bg-destructive/10"
                              >
                                Reject
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 5: LEAVE & OUTPASS APPROVALS (ADMIN STAGE) */}
          <TabsContent value="outpasses" className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-primary" />
                    <span>Leave & Outpass Authorization</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Admin central approval stage. Both Warden & Admin approval generate digital QR pass.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-44">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder="Filter student, pass..."
                      value={outpassSearch}
                      onChange={(e) => setOutpassSearch(e.target.value)}
                      className="pl-8 text-xs h-8"
                    />
                  </div>

                  <Select value={outpassStatusFilter} onValueChange={setOutpassStatusFilter}>
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Passes</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="checked_out">Checked Out</SelectItem>
                      <SelectItem value="returned">Returned</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Hostel & Room</TableHead>
                        <TableHead>Destination & Purpose</TableHead>
                        <TableHead>Out Time</TableHead>
                        <TableHead>Expected Return</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Admin Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOutpasses.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                            No outpass requests found for the selected filter.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredOutpasses.map((p) => (
                          <TableRow key={p._id}>
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm text-foreground">
                                  {p.student?.firstName} {p.student?.lastName}
                                </p>
                                <p className="text-xs text-muted-foreground font-mono">{p.student?.prn || 'N/A'}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">
                              {p.hostel || p.student?.hostel} • Rm {p.roomNumber || p.student?.roomNumber || '—'}
                            </TableCell>
                            <TableCell className="text-xs">
                              <p className="font-semibold text-foreground">{p.destination}</p>
                              <p className="text-muted-foreground truncate max-w-xs">{p.reason}</p>
                            </TableCell>
                            <TableCell className="text-xs">
                              {new Date(p.outDate || p.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-xs font-semibold">
                              {new Date(p.expectedReturnDate).toLocaleDateString()}{' '}
                              {new Date(p.expectedReturnDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  p.status === 'approved'
                                    ? 'default'
                                    : p.status === 'checked_out'
                                    ? 'outline'
                                    : p.status === 'returned'
                                    ? 'secondary'
                                    : p.status === 'rejected'
                                    ? 'destructive'
                                    : 'secondary'
                                }
                                className={`text-[10px] uppercase font-semibold ${
                                  p.status === 'approved' ? 'bg-emerald-600' : ''
                                }`}
                              >
                                {p.status.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {p.status === 'pending' ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setSelectedOutpass(p);
                                      setIsOutpassReviewOpen(true);
                                    }}
                                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedOutpass(p);
                                      setIsOutpassRejectReasonOpen(true);
                                    }}
                                    className="h-7 text-xs text-destructive hover:bg-destructive/10"
                                  >
                                    Reject
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground font-mono">
                                  {p.passCode ? `Pass: ${p.passCode}` : 'Reviewed'}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 6: ATTENDANCE & GATE ACTIVITY */}
          <TabsContent value="attendance" className="space-y-4">
            {/* Gate Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <Card className="p-4 shadow-sm">
                <span className="text-xs text-muted-foreground font-medium">On-Campus Present</span>
                <p className="text-2xl font-extrabold text-emerald-600 mt-1">
                  {gateAttendance?.summary?.onCampus || 0}
                </p>
                <span className="text-[11px] text-muted-foreground">Within hostel boundary</span>
              </Card>

              <Card className="p-4 shadow-sm">
                <span className="text-xs text-muted-foreground font-medium">Currently Checked OUT</span>
                <p className="text-2xl font-extrabold text-amber-600 mt-1">
                  {gateAttendance?.summary?.currentlyOut || 0}
                </p>
                <span className="text-[11px] text-muted-foreground">Scanned past gate</span>
              </Card>

              <Card className="p-4 shadow-sm">
                <span className="text-xs text-muted-foreground font-medium">Returned Today</span>
                <p className="text-2xl font-extrabold text-blue-600 mt-1">
                  {gateAttendance?.summary?.returned || 0}
                </p>
                <span className="text-[11px] text-muted-foreground">Completed gate entry</span>
              </Card>

              <Card className="p-4 shadow-sm">
                <span className="text-xs text-muted-foreground font-medium">Overdue Returns</span>
                <p className="text-2xl font-extrabold text-destructive mt-1">
                  {gateAttendance?.summary?.overdue || 0}
                </p>
                <span className="text-[11px] text-muted-foreground">Exceeded return curfew</span>
              </Card>
            </div>

            {/* Movement Logs Table */}
            <Card className="shadow-sm">
              <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Shield className="w-4 h-4 text-primary" />
                    <span>Verified Gate Movements</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Live timestamps registered by security gate officers upon physical scanning
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative w-44">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder="PRN or Pass code..."
                      value={gateSearchPRN}
                      onChange={(e) => setGateSearchPRN(e.target.value)}
                      className="pl-8 text-xs h-8"
                    />
                  </div>

                  <Select value={gateFilterStatus} onValueChange={setGateFilterStatus}>
                    <SelectTrigger className="w-36 h-8 text-xs">
                      <SelectValue placeholder="Movement Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Movements</SelectItem>
                      <SelectItem value="currently_out">Currently OUT</SelectItem>
                      <SelectItem value="returned">Returned</SelectItem>
                      <SelectItem value="overdue">Overdue Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pass Code</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>PRN</TableHead>
                        <TableHead>Hostel & Room</TableHead>
                        <TableHead>Destination</TableHead>
                        <TableHead>Gate OUT Time</TableHead>
                        <TableHead>Expected Return</TableHead>
                        <TableHead>Return Time</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Gate Officer</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredGateMovements.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-8 text-muted-foreground text-sm">
                            No gate movement records found for this period.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredGateMovements.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="font-mono text-xs font-bold text-foreground">
                              {m.passCode}
                            </TableCell>
                            <TableCell className="text-xs font-medium text-foreground">{m.studentName}</TableCell>
                            <TableCell className="text-xs font-mono">{m.prn}</TableCell>
                            <TableCell className="text-xs">
                              {m.hostel} {m.roomNumber ? `• Rm ${m.roomNumber}` : ''}
                            </TableCell>
                            <TableCell className="text-xs">{m.destination}</TableCell>
                            <TableCell className="text-xs font-semibold text-amber-600">{m.outTime}</TableCell>
                            <TableCell className="text-xs">{m.expectedReturn}</TableCell>
                            <TableCell className="text-xs font-semibold text-emerald-600">{m.returnTime}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  m.status === 'RETURNED'
                                    ? 'secondary'
                                    : m.status === 'OVERDUE'
                                    ? 'destructive'
                                    : 'outline'
                                }
                                className={`text-[10px] uppercase font-bold ${
                                  m.status === 'CURRENTLY OUT' ? 'border-amber-500 text-amber-600 bg-amber-50' : ''
                                }`}
                              >
                                {m.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{m.verifiedBy}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 7: NOTICES & HOSTEL RULES */}
          <TabsContent value="notices" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Official Hostel Notices & Regulations</h3>
                <p className="text-xs text-muted-foreground">Published university directives, curfew notices, and rules</p>
              </div>
              <Button size="sm" onClick={() => setIsCreateNoticeOpen(true)} className="gap-1.5 h-8 text-xs">
                <Plus className="w-3.5 h-3.5" />
                <span>Publish Notice</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {notices.map((n) => (
                <Card key={n._id} className="shadow-sm overflow-hidden flex flex-col justify-between">
                  <div>
                    {n.imageUrl && (
                      <div className="h-36 w-full overflow-hidden bg-muted">
                        <img src={n.imageUrl} alt={n.title} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <CardHeader className="p-4 pb-2">
                      <div className="flex justify-between items-start gap-2">
                        <CardTitle className="text-sm font-bold leading-snug text-foreground">{n.title}</CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteNotice(n._id)}
                          className="text-destructive h-6 w-6 p-0 hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(n.createdAt).toLocaleDateString()}
                      </span>
                    </CardHeader>
                    <CardContent className="p-4 pt-1">
                      <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                        {n.description}
                      </p>
                    </CardContent>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* TAB 8: MESS MENU */}
          <TabsContent value="mess" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Weekly Mess Menu Schedule</h3>
                <p className="text-xs text-muted-foreground">Nutritional meals served across student dining halls</p>
              </div>
              <div className="flex items-center gap-2">
                <Select value={selectedMessDay} onValueChange={setSelectedMessDay}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue placeholder="Day" />
                  </SelectTrigger>
                  <SelectContent>
                    {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(d => (
                      <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button size="sm" onClick={() => setIsEditMessOpen(true)} className="h-8 text-xs gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  <span>Update Meals</span>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {['breakfast', 'lunch', 'snacks', 'dinner'].map((meal) => {
                const menuRecord = messMenus.find(
                  m => (m.day || '').toLowerCase() === selectedMessDay.toLowerCase() && (m.mealType || '').toLowerCase() === meal
                );
                return (
                  <Card key={meal} className="shadow-sm">
                    <CardHeader className="p-4 pb-2 border-b border-border/50 bg-muted/30">
                      <CardTitle className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center justify-between">
                        <span>{meal}</span>
                        <Utensils className="w-4 h-4 text-primary" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2">
                      {menuRecord && menuRecord.items && menuRecord.items.length > 0 ? (
                        <ul className="space-y-1.5 text-xs text-foreground">
                          {menuRecord.items.map((it, idx) => (
                            <li key={idx} className="flex items-start gap-1.5">
                              <span className="text-primary font-bold">•</span>
                              <span>{it}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Standard campus menu configured.</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          {/* TAB 9: BUS ROUTES */}
          <TabsContent value="buses" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">University Shuttle & Bus Transport</h3>
                <p className="text-xs text-muted-foreground">Campus bus routes connecting hostel complexes and transit points</p>
              </div>
              <Button size="sm" onClick={() => setIsAddRouteOpen(true)} className="gap-1.5 h-8 text-xs">
                <Plus className="w-3.5 h-3.5" />
                <span>Add Bus Route</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {busRoutes.map((route) => (
                <Card key={route._id} className="shadow-sm">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        <Bus className="w-4 h-4 text-primary" />
                        <span>{route.routeName}</span>
                      </CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteBusRoute(route._id)}
                        className="text-destructive h-6 w-6 p-0 hover:bg-destructive/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-2 space-y-3">
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground">Route Stops:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {route.stops?.map((stop, i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">
                            {stop}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground">Departure Timings:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {route.timings?.map((timing, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] font-mono text-primary">
                            {timing}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* TAB 10: REPORTS */}
          <TabsContent value="reports" className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <div>
                <h3 className="text-base font-bold text-foreground">Operational Reports & Analytics</h3>
                <p className="text-xs text-muted-foreground">Verified statistical audit of hostel capacity and movements</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => window.print()} className="gap-1.5 h-8 text-xs">
                <Printer className="w-3.5 h-3.5" />
                <span>Print Report</span>
              </Button>
            </div>

            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold">Hostel Facility Operational Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Hostel Name</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Configured Rooms</TableHead>
                        <TableHead>Bed Capacity</TableHead>
                        <TableHead>Occupied Beds</TableHead>
                        <TableHead>Available Vacancies</TableHead>
                        <TableHead>Occupancy Rate</TableHead>
                        <TableHead>Active Students</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(stats?.hostelsBreakdown || []).map((h) => (
                        <TableRow key={h.id || h.name}>
                          <TableCell className="font-bold text-xs">{h.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{h.location}</TableCell>
                          <TableCell className="text-xs">{h.totalRooms}</TableCell>
                          <TableCell className="text-xs font-semibold">{h.totalCapacity}</TableCell>
                          <TableCell className="text-xs text-emerald-600 font-bold">{h.occupiedBeds}</TableCell>
                          <TableCell className="text-xs text-blue-600">{h.availableBeds}</TableCell>
                          <TableCell className="text-xs font-bold text-primary">{h.occupancyPercentage}%</TableCell>
                          <TableCell className="text-xs">{h.students}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* --- ALL MODAL DIALOGS --- */}

      {/* 1. Room Allocation Dialog */}
      <Dialog open={isAllocationDialogOpen} onOpenChange={setIsAllocationDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Allocate Room & Approve Registration</DialogTitle>
            <DialogDescription className="text-xs">
              Assign hostel, floor, and room number for {selectedStudentForAllocation?.firstName}{' '}
              {selectedStudentForAllocation?.lastName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label>Target Hostel</Label>
              <Select value={allocationHostel} onValueChange={setAllocationHostel}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select Hostel" />
                </SelectTrigger>
                <SelectContent>
                  {roomsByHostel.map((hb) => (
                    <SelectItem key={hb.hostel.id} value={hb.hostel.id}>
                      {hb.hostel.name} ({hb.counts.available} available rooms)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Floor</Label>
                <Input
                  type="number"
                  value={allocationFloor}
                  onChange={(e) => setAllocationFloor(e.target.value)}
                  min="1"
                  max="10"
                  className="h-9"
                />
              </div>

              <div className="space-y-1">
                <Label>Room Number</Label>
                <Input
                  placeholder="e.g. 101"
                  value={allocationRoomNumber}
                  onChange={(e) => setAllocationRoomNumber(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsAllocationDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleApproveAndAllocate} disabled={isAllocating} className="bg-emerald-600">
              {isAllocating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Confirm Allocation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. Reject Student Dialog */}
      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Student Registration</DialogTitle>
            <DialogDescription className="text-xs">
              Decline registration for {selectedStudentForReject?.firstName} {selectedStudentForReject?.lastName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label className="text-xs">Reason for Rejection</Label>
            <Textarea
              placeholder="State the reason (e.g. document mismatch, quota full)..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="text-xs"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="destructive" onClick={handleRejectStudent}>
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 3. Outpass Review & Approve Dialog */}
      <Dialog open={isOutpassReviewOpen} onOpenChange={setIsOutpassReviewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Outpass & Issue Pass Code</DialogTitle>
            <DialogDescription className="text-xs">
              Confirm central administration approval for {selectedOutpass?.student?.firstName} {selectedOutpass?.student?.lastName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 bg-muted/40 rounded-lg space-y-1">
              <p><strong>Destination:</strong> {selectedOutpass?.destination}</p>
              <p><strong>Purpose:</strong> {selectedOutpass?.reason}</p>
              <p><strong>Expected Return:</strong> {selectedOutpass?.expectedReturnDate ? new Date(selectedOutpass.expectedReturnDate).toLocaleString() : '—'}</p>
            </div>

            <div className="space-y-1">
              <Label>Admin Remarks (Optional)</Label>
              <Input
                placeholder="e.g. Approved for weekend visit"
                value={outpassAdminRemarks}
                onChange={(e) => setOutpassAdminRemarks(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsOutpassReviewOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleApproveOutpass} className="bg-emerald-600">
              Authorize Outpass
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. Outpass Reject Reason Dialog */}
      <Dialog open={isOutpassRejectReasonOpen} onOpenChange={setIsOutpassRejectReasonOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Outpass Request</DialogTitle>
            <DialogDescription className="text-xs">Provide a reason for rejecting this leave application</DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label className="text-xs">Rejection Note</Label>
            <Textarea
              placeholder="e.g. Curfew restrictions, parental authorization missing..."
              value={outpassRejectReason}
              onChange={(e) => setOutpassRejectReason(e.target.value)}
              className="text-xs"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsOutpassRejectReasonOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="destructive" onClick={handleRejectOutpass}>
              Reject Pass
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 5. Publish Notice Dialog */}
      <Dialog open={isCreateNoticeOpen} onOpenChange={setIsCreateNoticeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Publish Notice / Hostel Regulation</DialogTitle>
            <DialogDescription className="text-xs">
              Broadcast an announcement to all student dashboards
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label>Notice Title</Label>
              <Input
                placeholder="e.g. Weekend Curfew Advisory"
                value={newNoticeTitle}
                onChange={(e) => setNewNoticeTitle(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <Label>Description / Rules</Label>
              <Textarea
                placeholder="Details of the announcement..."
                value={newNoticeDesc}
                onChange={(e) => setNewNoticeDesc(e.target.value)}
                className="text-xs"
                rows={4}
              />
            </div>

            <div className="space-y-1">
              <Label>Image URL (Optional)</Label>
              <Input
                placeholder="https://..."
                value={newNoticeImage}
                onChange={(e) => setNewNoticeImage(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsCreateNoticeOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreateNotice}>
              Publish Announcement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 6. Edit Mess Menu Dialog */}
      <Dialog open={isEditMessOpen} onOpenChange={setIsEditMessOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Mess Menu ({selectedMessDay.toUpperCase()})</DialogTitle>
            <DialogDescription className="text-xs">
              Specify meal items for {selectedMessDay}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label>Meal Type</Label>
              <Select value={editMealType} onValueChange={setEditMealType}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Meal Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="breakfast">Breakfast</SelectItem>
                  <SelectItem value="lunch">Lunch</SelectItem>
                  <SelectItem value="snacks">Snacks</SelectItem>
                  <SelectItem value="dinner">Dinner</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Items (One per line)</Label>
              <Textarea
                placeholder="e.g.&#10;Dal Makhani&#10;Paneer Butter Masala&#10;Jeera Rice"
                value={editMealItemsText}
                onChange={(e) => setEditMealItemsText(e.target.value)}
                className="text-xs font-mono"
                rows={5}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsEditMessOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveMessMenu}>
              Save Menu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 7. Add Bus Route Dialog */}
      <Dialog open={isAddRouteOpen} onOpenChange={setIsAddRouteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Bus / Shuttle Route</DialogTitle>
            <DialogDescription className="text-xs">Configure campus transit timetable</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label>Route Name</Label>
              <Input
                placeholder="e.g. Route 4 - Airport Shuttle"
                value={newRouteName}
                onChange={(e) => setNewRouteName(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <Label>Stops (Comma separated)</Label>
              <Input
                placeholder="Hostel Gate, Lavale Village, Hinjawadi Phase 1"
                value={newRouteStops}
                onChange={(e) => setNewRouteStops(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-1">
              <Label>Timings (Comma separated)</Label>
              <Input
                placeholder="07:30 AM, 10:00 AM, 04:30 PM"
                value={newRouteTimings}
                onChange={(e) => setNewRouteTimings(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsAddRouteOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreateBusRoute}>
              Save Route
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
