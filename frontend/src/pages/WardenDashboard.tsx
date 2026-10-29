import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Users, Building2, DoorOpen, CheckCircle, XCircle, Clock, AlertCircle,
  FileText, Loader2, LogOut, QrCode, Search, Phone, Mail, MapPin,
  ShieldAlert, RefreshCw, ArrowRight, BedDouble, UserCheck
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authenticatedFetch, API_ENDPOINTS } from "@/lib/api-config";
import { useAuth } from "@/contexts/AuthContext";

interface DashboardStats {
  counts: {
    users: number;
    pendingUsers: number;
    rooms: number;
    capacity: number;
    occupants: number;
    availableSpots: number;
    bookings: number;
    complaints: number;
    outpasses: number;
  };
  occupancyRate: number;
}

interface WardenStudent {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  prn?: string;
  phone: string;
  status: string;
  hostel: string;
  floor: string;
  roomNumber: string;
  roomLocked: boolean;
  createdAt?: string;
}

interface WardenComplaint {
  _id: string;
  title: string;
  description: string;
  category: string;
  hostel: string;
  floor: string;
  roomNumber: string;
  status: string;
  assignedDepartment: string;
  adminNotes?: string;
  createdAt: string;
  user: {
    _id?: string;
    firstName: string;
    lastName: string;
    email: string;
    prn: string;
  };
}

interface WardenOutpass {
  _id: string;
  passCode: string;
  reason: string;
  category: string;
  destination: string;
  departureDate: string;
  expectedReturnDate: string;
  actualDepartureDate?: string;
  actualReturnDate?: string;
  emergencyContact: string;
  parentContact: string;
  status: string;
  isOverdue?: boolean;
  requestedAt?: string;
  createdAt: string;
  student: {
    _id?: string;
    firstName: string;
    lastName: string;
    email: string;
    prn: string;
    phone: string;
    hostel: string;
    roomNumber: string;
  };
  approvedBy?: {
    firstName: string;
    lastName: string;
    designation: string;
    role: string;
  };
  rejectedBy?: {
    firstName: string;
    lastName: string;
  };
  checkedOutBy?: {
    firstName: string;
    lastName: string;
    role: string;
  };
  returnedBy?: {
    firstName: string;
    lastName: string;
    role: string;
  };
  auditLog?: Array<{
    action?: string;
    performedBy?: string | { firstName?: string; lastName?: string; role?: string };
    timestamp?: string;
    remarks?: string;
  }>;
}

interface RoomOccupant {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  prn?: string;
}

interface RoomDoc {
  _id: string;
  roomNumber: string;
  floor: number;
  capacity: number;
  occupants?: RoomOccupant[];
  isOccupied?: boolean;
  hostel?: string | { _id: string; name: string };
}

interface HostelDetails {
  _id: string;
  name: string;
  description?: string;
  location?: string;
  address?: string;
  floors?: number;
  totalRooms?: number;
  totalCapacity?: number;
  amenities?: string[];
  contactPhone?: string;
  contactEmail?: string;
  warden?: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
}

interface WardenDashboardProps {
  defaultTab?: string;
}

const WardenDashboard: React.FC<WardenDashboardProps> = ({ defaultTab }) => {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Determine active tab from location pathname, defaultTab, or search params
  const computeInitialTab = () => {
    if (defaultTab) return defaultTab;
    const path = location.pathname.toLowerCase();
    if (path.includes('/warden/hostel')) return 'hostel';
    if (path.includes('/warden/students')) return 'students';
    if (path.includes('/warden/pending-students')) return 'pending';
    if (path.includes('/warden/complaints')) return 'complaints';
    if (path.includes('/warden/outpasses')) return 'outpasses';
    if (path.includes('/warden/gate-activity')) return 'gate';
    return searchParams.get('tab') || 'dashboard';
  };

  const [activeTab, setActiveTab] = useState<string>(computeInitialTab);

  // Core Data States
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [hostel, setHostel] = useState<HostelDetails | null>(null);
  const [rooms, setRooms] = useState<RoomDoc[]>([]);
  const [students, setStudents] = useState<Array<WardenStudent>>([]);
  const [pendingStudents, setPendingStudents] = useState<Array<WardenStudent>>([]);
  const [complaints, setComplaints] = useState<Array<WardenComplaint>>([]);
  const [outpasses, setOutpasses] = useState<Array<WardenOutpass>>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [studentSearch, setStudentSearch] = useState('');
  const [studentStatusFilter, setStudentStatusFilter] = useState('all');

  const [roomFloorFilter, setRoomFloorFilter] = useState('all');
  const [roomAvailabilityFilter, setRoomAvailabilityFilter] = useState('all');
  const [roomSearch, setRoomSearch] = useState('');

  const [complaintCategoryFilter, setComplaintCategoryFilter] = useState('all');
  const [complaintStatusFilter, setComplaintStatusFilter] = useState('all');
  const [complaintSearch, setComplaintSearch] = useState('');

  const [outpassStatusFilter, setOutpassStatusFilter] = useState('all');
  const [outpassSearch, setOutpassSearch] = useState('');

  // Dialog States
  const [selectedComplaint, setSelectedComplaint] = useState<WardenComplaint | null>(null);
  const [isComplaintDialogOpen, setIsComplaintDialogOpen] = useState(false);
  const [complaintUpdateData, setComplaintUpdateData] = useState({
    status: '',
    assignedDepartment: '',
    adminNotes: ''
  });

  const [selectedStudentForAllocation, setSelectedStudentForAllocation] = useState<WardenStudent | null>(null);
  const [allocationFloor, setAllocationFloor] = useState('');
  const [allocationRoomNumber, setAllocationRoomNumber] = useState('');
  const [isAllocationDialogOpen, setIsAllocationDialogOpen] = useState(false);

  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [selectedStudentForReject, setSelectedStudentForReject] = useState<WardenStudent | null>(null);

  const [selectedOutpass, setSelectedOutpass] = useState<WardenOutpass | null>(null);
  const [outpassRemarks, setOutpassRemarks] = useState('');
  const [outpassAction, setOutpassAction] = useState<'approve' | 'reject'>('approve');
  const [isOutpassDialogOpen, setIsOutpassDialogOpen] = useState(false);
  const [isProcessingOutpass, setIsProcessingOutpass] = useState(false);

  const [selectedStudentDetail, setSelectedStudentDetail] = useState<WardenStudent | null>(null);
  const [isStudentDetailOpen, setIsStudentDetailOpen] = useState(false);

  const { toast } = useToast();

  // Synchronize Tab with Route Changes
  useEffect(() => {
    const path = location.pathname.toLowerCase();
    let newTab = 'dashboard';
    if (path.includes('/warden/hostel')) newTab = 'hostel';
    else if (path.includes('/warden/students')) newTab = 'students';
    else if (path.includes('/warden/pending-students')) newTab = 'pending';
    else if (path.includes('/warden/complaints')) newTab = 'complaints';
    else if (path.includes('/warden/outpasses')) newTab = 'outpasses';
    else if (path.includes('/warden/gate-activity')) newTab = 'gate';
    else if (defaultTab) newTab = defaultTab;
    else if (searchParams.get('tab')) newTab = searchParams.get('tab')!;

    if (newTab !== activeTab) {
      setActiveTab(newTab);
    }
  }, [location.pathname, defaultTab, searchParams, activeTab]);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    if (val === 'dashboard') navigate('/warden/dashboard');
    else if (val === 'hostel') navigate('/warden/hostel');
    else if (val === 'students') navigate('/warden/students');
    else if (val === 'pending') navigate('/warden/pending-students');
    else if (val === 'complaints') navigate('/warden/complaints');
    else if (val === 'outpasses') navigate('/warden/outpasses');
    else if (val === 'gate') navigate('/warden/gate-activity');
  };

  // Fetch Handlers
  const fetchDashboardData = async () => {
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.WARDEN_DASHBOARD);
      if (res.ok) {
        const data = await res.json();
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error fetching warden dashboard stats:', error);
    }
  };

  const fetchHostelDetails = async () => {
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.WARDEN_HOSTEL);
      if (res.ok) {
        const data = await res.json();
        setHostel(data.data || null);
      }
    } catch (err) {
      console.error('Error fetching hostel details:', err);
    }
  };

  const fetchRooms = async () => {
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.ROOMS);
      if (res.ok) {
        const data = await res.json();
        const allRooms: RoomDoc[] = data.data || [];
        setRooms(allRooms);
      }
    } catch (err) {
      console.error('Error fetching rooms:', err);
    }
  };

  const fetchWardenStudents = async () => {
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.WARDEN_STUDENTS);
      if (res.ok) {
        const data = await res.json();
        setStudents(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch warden students:', err);
    }
  };

  const fetchPendingWardenStudents = async () => {
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.WARDEN_PENDING_STUDENTS);
      if (res.ok) {
        const data = await res.json();
        setPendingStudents(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch pending warden students:', err);
    }
  };

  const fetchWardenComplaints = async () => {
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.WARDEN_COMPLAINTS);
      if (res.ok) {
        const data = await res.json();
        setComplaints(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch warden complaints:', err);
    }
  };

  const fetchWardenOutpasses = async () => {
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.WARDEN_OUTPASSES);
      if (res.ok) {
        const data = await res.json();
        setOutpasses(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch warden outpasses:', err);
    }
  };

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([
      fetchDashboardData(),
      fetchHostelDetails(),
      fetchRooms(),
      fetchWardenStudents(),
      fetchPendingWardenStudents(),
      fetchWardenComplaints(),
      fetchWardenOutpasses()
    ]);
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Deep linking handler from URL query params
  useEffect(() => {
    if (loading) return;

    const studentId = searchParams.get('studentId');
    const complaintId = searchParams.get('complaintId');
    const outpassId = searchParams.get('outpassId');

    if (studentId) {
      const s = students.find(item => String(item._id) === studentId) ||
                pendingStudents.find(item => String(item._id) === studentId);
      if (s) {
        setSelectedStudentForAllocation(s);
        setIsAllocationDialogOpen(true);
      }
    } else if (complaintId) {
      const c = complaints.find(item => String(item._id) === complaintId);
      if (c) {
        setSelectedComplaint(c);
        setComplaintUpdateData({
          status: c.status,
          assignedDepartment: c.assignedDepartment || '',
          adminNotes: c.adminNotes || ''
        });
        setIsComplaintDialogOpen(true);
      }
    } else if (outpassId) {
      const o = outpasses.find(item => String(item._id) === outpassId || item.passCode === outpassId);
      if (o) {
        setSelectedOutpass(o);
        setOutpassAction('approve');
        setIsOutpassDialogOpen(true);
      }
    }
  }, [loading, searchParams, students, pendingStudents, complaints, outpasses]);

  // Actions
  const handleApproveAndAllocate = async () => {
    if (!selectedStudentForAllocation) return;
    if (!allocationFloor || !allocationRoomNumber) {
      toast({
        title: "Required Fields Missing",
        description: "Please specify both floor and room number for allocation.",
        variant: "destructive"
      });
      return;
    }

    try {
      const res = await authenticatedFetch(
        `${API_ENDPOINTS.WARDEN_STUDENTS}/${selectedStudentForAllocation._id}/approve-and-allocate`,
        {
          method: 'POST',
          body: JSON.stringify({
            floor: allocationFloor.trim(),
            roomNumber: allocationRoomNumber.trim()
          })
        }
      );

      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: "Student Approved & Allocated",
          description: `Allocated to Room ${allocationRoomNumber} successfully.`
        });
        setIsAllocationDialogOpen(false);
        setSelectedStudentForAllocation(null);
        setAllocationFloor('');
        setAllocationRoomNumber('');
        fetchDashboardData();
        fetchWardenStudents();
        fetchPendingWardenStudents();
        fetchRooms();
      } else {
        toast({
          title: "Allocation Failed",
          description: data.message || "Failed to approve and allocate student.",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Network Error",
        description: "Could not connect to server during room allocation.",
        variant: "destructive"
      });
    }
  };

  const handleRejectStudent = async () => {
    if (!selectedStudentForReject) return;
    if (!rejectionReason.trim()) {
      toast({
        title: "Rejection Reason Required",
        description: "Please provide a valid explanation for rejecting the registration.",
        variant: "destructive"
      });
      return;
    }

    try {
      const res = await authenticatedFetch(
        `${API_ENDPOINTS.WARDEN_STUDENTS}/${selectedStudentForReject._id}/reject`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: rejectionReason.trim() })
        }
      );

      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: "Registration Rejected",
          description: "Student has been marked as rejected."
        });
        setIsRejectDialogOpen(false);
        setSelectedStudentForReject(null);
        setRejectionReason('');
        fetchPendingWardenStudents();
        fetchWardenStudents();
        fetchDashboardData();
      } else {
        toast({
          title: "Action Failed",
          description: data.message || "Failed to reject student registration.",
          variant: "destructive"
        });
      }
    } catch {
      toast({
        title: "Network Error",
        description: "Could not connect to server.",
        variant: "destructive"
      });
    }
  };

  const handleUpdateComplaint = async () => {
    if (!selectedComplaint) return;

    try {
      const res = await authenticatedFetch(
        API_ENDPOINTS.ADMIN_COMPLAINT_UPDATE(selectedComplaint._id),
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: complaintUpdateData.status,
            assignedDepartment: complaintUpdateData.assignedDepartment,
            adminNotes: complaintUpdateData.adminNotes
          })
        }
      );

      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: "Complaint Updated",
          description: `Complaint status updated to ${complaintUpdateData.status}.`
        });
        setIsComplaintDialogOpen(false);
        setSelectedComplaint(null);
        fetchWardenComplaints();
        fetchDashboardData();
      } else {
        toast({
          title: "Update Failed",
          description: data.message || "Failed to update complaint.",
          variant: "destructive"
        });
      }
    } catch {
      toast({
        title: "Network Error",
        description: "Could not connect to server to update complaint.",
        variant: "destructive"
      });
    }
  };

  const handleApproveOutpass = async () => {
    if (!selectedOutpass) return;
    setIsProcessingOutpass(true);

    try {
      const res = await authenticatedFetch(
        API_ENDPOINTS.ADMIN_OUTPASS_APPROVE(selectedOutpass._id),
        {
          method: 'PUT',
          body: JSON.stringify({ adminRemarks: outpassRemarks || 'Approved by Warden' })
        }
      );

      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: "Outpass Approved",
          description: `Gate Pass generated: ${data.data?.passCode || selectedOutpass.passCode}`
        });
        setIsOutpassDialogOpen(false);
        setSelectedOutpass(null);
        setOutpassRemarks('');
        fetchWardenOutpasses();
        fetchDashboardData();
      } else {
        toast({
          title: "Approval Failed",
          description: data.message || "Failed to approve outpass.",
          variant: "destructive"
        });
      }
    } catch {
      toast({
        title: "Network Error",
        description: "Failed to connect to server.",
        variant: "destructive"
      });
    } finally {
      setIsProcessingOutpass(false);
    }
  };

  const handleRejectOutpass = async () => {
    if (!selectedOutpass) return;
    if (!outpassRemarks.trim()) {
      toast({
        title: "Remarks Required",
        description: "Please specify why this outpass request is being rejected.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessingOutpass(true);

    try {
      const res = await authenticatedFetch(
        API_ENDPOINTS.ADMIN_OUTPASS_REJECT(selectedOutpass._id),
        {
          method: 'PUT',
          body: JSON.stringify({ adminRemarks: outpassRemarks.trim() })
        }
      );

      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: "Outpass Rejected",
          description: "Outpass has been rejected."
        });
        setIsOutpassDialogOpen(false);
        setSelectedOutpass(null);
        setOutpassRemarks('');
        fetchWardenOutpasses();
        fetchDashboardData();
      } else {
        toast({
          title: "Action Failed",
          description: data.message || "Failed to reject outpass.",
          variant: "destructive"
        });
      }
    } catch {
      toast({
        title: "Network Error",
        description: "Failed to connect to server.",
        variant: "destructive"
      });
    } finally {
      setIsProcessingOutpass(false);
    }
  };

  // Filtered Collections
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const fullName = `${s.firstName || ''} ${s.lastName || ''}`.toLowerCase();
      const prn = (s.prn || '').toLowerCase();
      const email = (s.email || '').toLowerCase();
      const room = (s.roomNumber || '').toLowerCase();
      const q = studentSearch.toLowerCase().trim();

      const matchesSearch = !q || fullName.includes(q) || prn.includes(q) || email.includes(q) || room.includes(q);
      const matchesStatus = studentStatusFilter === 'all' || s.status === studentStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [students, studentSearch, studentStatusFilter]);

  const filteredComplaints = useMemo(() => {
    return complaints.filter(c => {
      const title = (c.title || '').toLowerCase();
      const studentName = c.user ? `${c.user.firstName || ''} ${c.user.lastName || ''}`.toLowerCase() : '';
      const q = complaintSearch.toLowerCase().trim();

      const matchesSearch = !q || title.includes(q) || studentName.includes(q);
      const matchesCategory = complaintCategoryFilter === 'all' || c.category === complaintCategoryFilter;
      const matchesStatus = complaintStatusFilter === 'all' || c.status === complaintStatusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [complaints, complaintSearch, complaintCategoryFilter, complaintStatusFilter]);

  const filteredOutpasses = useMemo(() => {
    return outpasses.filter(o => {
      const passCode = (o.passCode || '').toLowerCase();
      const studentName = o.student ? `${o.student.firstName || ''} ${o.student.lastName || ''}`.toLowerCase() : '';
      const dest = (o.destination || '').toLowerCase();
      const q = outpassSearch.toLowerCase().trim();

      const matchesSearch = !q || passCode.includes(q) || studentName.includes(q) || dest.includes(q);
      
      let matchesStatus = true;
      if (outpassStatusFilter === 'overdue') {
        matchesStatus = !!o.isOverdue;
      } else if (outpassStatusFilter !== 'all') {
        matchesStatus = o.status === outpassStatusFilter;
      }

      return matchesSearch && matchesStatus;
    });
  }, [outpasses, outpassSearch, outpassStatusFilter]);

  const filteredRooms = useMemo(() => {
    return rooms.filter(r => {
      const roomNum = (r.roomNumber || '').toLowerCase();
      const q = roomSearch.toLowerCase().trim();
      const matchesSearch = !q || roomNum.includes(q);

      const matchesFloor = roomFloorFilter === 'all' || String(r.floor) === roomFloorFilter;

      const occCount = (r.occupants || []).length;
      let matchesAvail = true;
      if (roomAvailabilityFilter === 'available') {
        matchesAvail = occCount < r.capacity;
      } else if (roomAvailabilityFilter === 'full') {
        matchesAvail = occCount >= r.capacity;
      }

      return matchesSearch && matchesFloor && matchesAvail;
    });
  }, [rooms, roomSearch, roomFloorFilter, roomAvailabilityFilter]);

  // Derived gate metrics
  const currentlyOutsideOutpasses = useMemo(() => {
    return outpasses.filter(o => o.status === 'checked_out' || o.status === 'used');
  }, [outpasses]);

  const overdueOutpasses = useMemo(() => {
    const now = new Date();
    return outpasses.filter(o => {
      if (o.isOverdue) return true;
      if ((o.status === 'checked_out' || o.status === 'used') && o.expectedReturnDate) {
        return now > new Date(o.expectedReturnDate);
      }
      return false;
    });
  }, [outpasses]);

  // Auth Guards
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Authenticating session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    navigate("/login");
    return null;
  }

  if (!['warden', 'super_admin'].includes(user.role as string)) {
    navigate("/");
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="h-14 w-14 text-destructive mb-3" />
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p className="text-muted-foreground mt-1">Warden authorization required for this portal.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="container mx-auto px-4 py-8">
        {/* Dynamic Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-4 border-b border-border/40">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight gradient-primary bg-clip-text text-transparent">
                {activeTab === 'dashboard' && 'Warden Dashboard'}
                {activeTab === 'hostel' && 'My Hostel & Room Allocations'}
                {activeTab === 'students' && 'Hostel Students Directory'}
                {activeTab === 'pending' && 'Pending Registrations Review'}
                {activeTab === 'complaints' && 'Hostel Complaints Management'}
                {activeTab === 'outpasses' && 'Digital Outpasses Management'}
                {activeTab === 'gate' && 'Campus Gate Activity & Movement'}
              </h1>
              {hostel && (
                <Badge variant="outline" className="text-sm font-semibold border-primary/30 text-primary bg-primary/5">
                  <Building2 className="w-3.5 h-3.5 mr-1" />
                  {hostel.name}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {activeTab === 'dashboard' && `Overview & real-time analytics for ${hostel?.name || 'assigned hostel'}`}
              {activeTab === 'hostel' && `Floor maps, room capacities, and bed occupancy for ${hostel?.name || 'your hostel'}`}
              {activeTab === 'students' && `All allocated student records and resident details (${students.length} total)`}
              {activeTab === 'pending' && `New student registrations awaiting room allocation (${pendingStudents.length} pending)`}
              {activeTab === 'complaints' && `Resident tickets for room maintenance, plumbing, electrical, and facility issues (${complaints.length} total)`}
              {activeTab === 'outpasses' && `Leave requests and digital gate pass approvals for hostel students (${outpasses.length} total)`}
              {activeTab === 'gate' && `Security gate checkouts, expected returns, and overdue student monitoring`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={refreshAll} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh Data
            </Button>
          </div>
        </div>

        {/* Global Overdue Banner if overdue students exist */}
        {overdueOutpasses.length > 0 && (
          <div className="mb-6 p-4 rounded-xl border border-destructive/40 bg-destructive/10 flex items-start justify-between gap-4 animate-pulse">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-destructive shrink-0" />
              <div>
                <h4 className="font-semibold text-destructive">
                  Overdue Students Alert ({overdueOutpasses.length})
                </h4>
                <p className="text-xs text-muted-foreground">
                  One or more students from your hostel have passed their expected return time and have not checked in at the gate.
                </p>
              </div>
            </div>
            <Button size="sm" variant="destructive" onClick={() => handleTabChange('gate')}>
              View Overdue List →
            </Button>
          </div>
        )}

        {/* Page Content View */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">

          {/* ===================== TAB 1: OVERVIEW DASHBOARD ===================== */}
          <TabsContent value="dashboard" className="space-y-6">
            {!stats ? (
              <div className="text-center py-16">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
                <p className="text-sm text-muted-foreground">Loading hostel analytics...</p>
              </div>
            ) : (
              <>
                {/* 6 Clickable Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {/* Card 1: Occupancy */}
                  <Card
                    onClick={() => handleTabChange('hostel')}
                    className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
                  >
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Hostel Occupancy</CardTitle>
                      <Building2 className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-3xl font-extrabold text-foreground">{stats.occupancyRate}%</span>
                        <Badge variant="outline" className="text-xs">
                          {stats.counts.availableSpots} spots free
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {stats.counts.occupants} beds occupied out of {stats.counts.capacity} capacity ({stats.counts.rooms} total rooms)
                      </p>
                      <div className="pt-2 flex items-center text-xs font-semibold text-primary group-hover:translate-x-1 transition-transform">
                        <span>Manage Hostel & Rooms</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card 2: Active Students */}
                  <Card
                    onClick={() => handleTabChange('students')}
                    className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
                  >
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Total Students</CardTitle>
                      <Users className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-3xl font-extrabold text-foreground">{stats.counts.users}</span>
                        <Badge variant="secondary" className="text-xs">
                          {students.filter(s => s.status === 'approved').length} Active
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Registered students allocated to your hostel
                      </p>
                      <div className="pt-2 flex items-center text-xs font-semibold text-primary group-hover:translate-x-1 transition-transform">
                        <span>View Students Directory</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card 3: Pending Approvals */}
                  <Card
                    onClick={() => handleTabChange('pending')}
                    className={`cursor-pointer hover:shadow-md transition-all group ${
                      stats.counts.pendingUsers > 0 ? 'border-amber-500/50 bg-amber-500/5' : ''
                    }`}
                  >
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approvals</CardTitle>
                      <UserCheck className="w-5 h-5 text-amber-500 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-3xl font-extrabold text-amber-600">{stats.counts.pendingUsers}</span>
                        {stats.counts.pendingUsers > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            Action Needed
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Students awaiting registration verification & room assignment
                      </p>
                      <div className="pt-2 flex items-center text-xs font-semibold text-amber-600 group-hover:translate-x-1 transition-transform">
                        <span>Review Registrations</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card 4: Complaints */}
                  <Card
                    onClick={() => handleTabChange('complaints')}
                    className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
                  >
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Complaints</CardTitle>
                      <FileText className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-3xl font-extrabold text-foreground">{stats.counts.complaints}</span>
                        <Badge variant="secondary" className="text-xs">
                          {complaints.filter(c => c.status === 'pending').length} Unresolved
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Maintenance and room service tickets filed by hostel residents
                      </p>
                      <div className="pt-2 flex items-center text-xs font-semibold text-primary group-hover:translate-x-1 transition-transform">
                        <span>Manage Complaints</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card 5: Outpasses */}
                  <Card
                    onClick={() => handleTabChange('outpasses')}
                    className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
                  >
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Digital Outpasses</CardTitle>
                      <QrCode className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-3xl font-extrabold text-foreground">{stats.counts.outpasses}</span>
                        <Badge variant="outline" className="text-xs">
                          {outpasses.filter(o => o.status === 'pending').length} Pending Review
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Leave and night-out requests submitted by students
                      </p>
                      <div className="pt-2 flex items-center text-xs font-semibold text-primary group-hover:translate-x-1 transition-transform">
                        <span>Review & Approve Passes</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card 6: Gate & Security Status */}
                  <Card
                    onClick={() => handleTabChange('gate')}
                    className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
                  >
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">Campus Gate Activity</CardTitle>
                      <DoorOpen className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-baseline justify-between">
                        <span className="text-3xl font-extrabold text-foreground">
                          {currentlyOutsideOutpasses.length}
                        </span>
                        {overdueOutpasses.length > 0 ? (
                          <Badge variant="destructive" className="text-xs">
                            {overdueOutpasses.length} Overdue
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-500/30">
                            Normal
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Students currently checked out of campus through Security gate
                      </p>
                      <div className="pt-2 flex items-center text-xs font-semibold text-primary group-hover:translate-x-1 transition-transform">
                        <span>View Gate Movement Log</span>
                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Quick Action Preview Section */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                  {/* Urgent Pending Registrations */}
                  <Card>
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-base font-semibold">Pending Registrations</CardTitle>
                        <CardDescription className="text-xs">Students waiting for room allocation</CardDescription>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleTabChange('pending')}>
                        View All ({pendingStudents.length}) →
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {pendingStudents.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                          No pending student registrations. All caught up!
                        </div>
                      ) : (
                        <div className="divide-y divide-border/50">
                          {pendingStudents.slice(0, 3).map(student => (
                            <div key={student._id} className="py-3 flex items-center justify-between gap-2">
                              <div>
                                <p className="font-medium text-sm">{student.firstName} {student.lastName}</p>
                                <p className="text-xs text-muted-foreground">PRN: {student.prn || 'N/A'} • {student.email}</p>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedStudentForAllocation(student);
                                  setIsAllocationDialogOpen(true);
                                }}
                              >
                                Allocate Room
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Urgent Pending Complaints */}
                  <Card>
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-base font-semibold">Recent Complaints</CardTitle>
                        <CardDescription className="text-xs">Latest maintenance and room requests</CardDescription>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleTabChange('complaints')}>
                        View All ({complaints.length}) →
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {complaints.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                          <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                          No complaints reported in your hostel.
                        </div>
                      ) : (
                        <div className="divide-y divide-border/50">
                          {complaints.slice(0, 3).map(complaint => (
                            <div key={complaint._id} className="py-3 flex items-center justify-between gap-2">
                              <div className="max-w-[70%]">
                                <p className="font-medium text-sm truncate">{complaint.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  Room {complaint.roomNumber || 'N/A'} • {complaint.category} • {new Date(complaint.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                              <Badge
                                variant={
                                  complaint.status === 'pending'
                                    ? 'destructive'
                                    : complaint.status === 'in_progress'
                                    ? 'secondary'
                                    : 'outline'
                                }
                                className="text-xs shrink-0"
                              >
                                {complaint.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          {/* ===================== TAB 2: MY HOSTEL ===================== */}
          <TabsContent value="hostel" className="space-y-6">
            {hostel ? (
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-background">
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-6 h-6 text-primary" />
                        <CardTitle className="text-2xl font-bold">{hostel.name}</CardTitle>
                      </div>
                      <CardDescription className="mt-1 text-sm">
                        {hostel.location || 'Symbiosis Campus'} • {hostel.description || 'Symbiosis International University Hostel'}
                      </CardDescription>
                    </div>
                    <Badge variant="default" className="text-sm px-3 py-1 self-start md:self-auto">
                      Assigned Hostel
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-3 rounded-lg bg-card border border-border/50 text-center">
                      <p className="text-xs text-muted-foreground">Total Capacity</p>
                      <p className="text-2xl font-bold mt-1">{stats?.counts.capacity || hostel.totalCapacity || 0}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-card border border-border/50 text-center">
                      <p className="text-xs text-muted-foreground">Occupied Beds</p>
                      <p className="text-2xl font-bold mt-1 text-primary">{stats?.counts.occupants || 0}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-card border border-border/50 text-center">
                      <p className="text-xs text-muted-foreground">Available Spots</p>
                      <p className="text-2xl font-bold mt-1 text-emerald-600">{stats?.counts.availableSpots || 0}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-card border border-border/50 text-center">
                      <p className="text-xs text-muted-foreground">Total Rooms</p>
                      <p className="text-2xl font-bold mt-1">{stats?.counts.rooms || hostel.totalRooms || rooms.length}</p>
                    </div>
                  </div>

                  {/* Amenities */}
                  {hostel.amenities && hostel.amenities.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Amenities</h4>
                      <div className="flex flex-wrap gap-2">
                        {hostel.amenities.map((amenity, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs bg-muted/40">
                            ✓ {amenity}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No assigned hostel record found. Please contact administration.
                </CardContent>
              </Card>
            )}

            {/* Room Allocation and Directory Section */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">Hostel Rooms & Bed Allocations</CardTitle>
                    <CardDescription className="text-xs">
                      Live status of rooms, bed capacities, and current resident allocations
                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    Showing {filteredRooms.length} of {rooms.length} Rooms
                  </Badge>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      placeholder="Search room number..."
                      value={roomSearch}
                      onChange={e => setRoomSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  <Select value={roomFloorFilter} onValueChange={setRoomFloorFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Floor Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Floors</SelectItem>
                      <SelectItem value="0">Ground Floor</SelectItem>
                      <SelectItem value="1">1st Floor</SelectItem>
                      <SelectItem value="2">2nd Floor</SelectItem>
                      <SelectItem value="3">3rd Floor</SelectItem>
                      <SelectItem value="4">4th Floor</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={roomAvailabilityFilter} onValueChange={setRoomAvailabilityFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Availability" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Rooms</SelectItem>
                      <SelectItem value="available">Spots Available</SelectItem>
                      <SelectItem value="full">Completely Full</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {filteredRooms.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    No rooms match the selected criteria.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredRooms.map(r => {
                      const occCount = (r.occupants || []).length;
                      const isFull = occCount >= r.capacity;
                      return (
                        <div
                          key={r._id}
                          className={`p-4 rounded-xl border transition-all ${
                            isFull ? 'bg-muted/30 border-border' : 'bg-card border-primary/20 shadow-sm'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-lg font-bold text-foreground">Room {r.roomNumber}</span>
                              <p className="text-xs text-muted-foreground">Floor {r.floor}</p>
                            </div>
                            <Badge variant={isFull ? 'secondary' : 'default'} className="text-xs">
                              {occCount} / {r.capacity} Beds
                            </Badge>
                          </div>

                          {/* Occupants list */}
                          <div className="mt-3 pt-3 border-t border-border/50 space-y-1.5">
                            <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                              Occupants:
                            </p>
                            {occCount === 0 ? (
                              <p className="text-xs text-emerald-600 font-medium">Vacant — Ready for allocation</p>
                            ) : (
                              (r.occupants || []).map(occ => (
                                <div key={occ._id} className="text-xs flex items-center justify-between text-muted-foreground">
                                  <span className="truncate text-foreground font-medium">
                                    • {occ.firstName} {occ.lastName}
                                  </span>
                                  <span className="text-[11px] font-mono">{occ.prn || ''}</span>
                                </div>
                              ))
                            )}
                          </div>

                          {!isFull && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full mt-3 text-xs"
                              onClick={() => {
                                setAllocationFloor(String(r.floor));
                                setAllocationRoomNumber(r.roomNumber);
                                handleTabChange('pending');
                                toast({
                                  title: `Room ${r.roomNumber} Selected`,
                                  description: "Select a pending student to complete allocation."
                                });
                              }}
                            >
                              <BedDouble className="w-3.5 h-3.5 mr-1" />
                              Allocate To Room {r.roomNumber}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===================== TAB 3: STUDENTS DIRECTORY ===================== */}
          <TabsContent value="students" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">Hostel Students Directory</CardTitle>
                    <CardDescription className="text-xs">
                      All registered student records assigned to your hostel
                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    Showing {filteredStudents.length} of {students.length} Students
                  </Badge>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
                  <div className="relative sm:col-span-2">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      placeholder="Search by student name, PRN, email, or room number..."
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={studentStatusFilter} onValueChange={setStudentStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {filteredStudents.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    No students found matching your search.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student Name</TableHead>
                          <TableHead>PRN</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Assigned Room</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredStudents.map(student => (
                          <TableRow key={student._id}>
                            <TableCell className="font-medium text-foreground">
                              {student.firstName} {student.lastName}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{student.prn || 'N/A'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{student.email}</TableCell>
                            <TableCell className="text-xs">{student.phone || 'N/A'}</TableCell>
                            <TableCell>
                              {student.roomNumber ? (
                                <Badge variant="outline" className="font-mono text-xs">
                                  Room {student.roomNumber} (Fl. {student.floor || '1'})
                                </Badge>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">Unassigned</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  student.status === 'approved'
                                    ? 'default'
                                    : student.status === 'pending'
                                    ? 'secondary'
                                    : 'destructive'
                                }
                                className="text-xs"
                              >
                                {student.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedStudentDetail(student);
                                    setIsStudentDetailOpen(true);
                                  }}
                                >
                                  Details
                                </Button>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedStudentForAllocation(student);
                                    setAllocationFloor(student.floor || '');
                                    setAllocationRoomNumber(student.roomNumber || '');
                                    setIsAllocationDialogOpen(true);
                                  }}
                                >
                                  {student.roomNumber ? 'Reassign' : 'Allocate'}
                                </Button>
                              </div>
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

          {/* ===================== TAB 4: PENDING STUDENTS ===================== */}
          <TabsContent value="pending" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">Pending Registrations Review</CardTitle>
                    <CardDescription className="text-xs">
                      Review new registrations, verify eligibility, and assign approved hostel rooms
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-amber-600 bg-amber-500/10 border-amber-500/30">
                    {pendingStudents.length} Pending
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {pendingStudents.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground">
                    <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-90" />
                    <h3 className="text-base font-semibold text-foreground">No Pending Registrations</h3>
                    <p className="text-xs mt-1">All student accounts for your hostel have been reviewed and allocated.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>PRN</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Registered Date</TableHead>
                          <TableHead className="text-right">Decision Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingStudents.map(student => (
                          <TableRow key={student._id}>
                            <TableCell className="font-medium text-foreground">
                              {student.firstName} {student.lastName}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{student.prn || 'N/A'}</TableCell>
                            <TableCell className="text-xs">{student.email}</TableCell>
                            <TableCell className="text-xs">{student.phone || 'N/A'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {student.createdAt ? new Date(student.createdAt).toLocaleDateString() : 'Recent'}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() => {
                                    setSelectedStudentForAllocation(student);
                                    setIsAllocationDialogOpen(true);
                                  }}
                                >
                                  Approve & Allocate Room
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedStudentForReject(student);
                                    setIsRejectDialogOpen(true);
                                  }}
                                >
                                  Reject
                                </Button>
                              </div>
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

          {/* ===================== TAB 5: COMPLAINTS ===================== */}
          <TabsContent value="complaints" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">Hostel Complaints & Work Orders</CardTitle>
                    <CardDescription className="text-xs">
                      Monitor and resolve room maintenance, plumbing, electrical, and facility tickets
                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    Showing {filteredComplaints.length} of {complaints.length} Complaints
                  </Badge>
                </div>

                {/* Complaint Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      placeholder="Search title or student..."
                      value={complaintSearch}
                      onChange={e => setComplaintSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  <Select value={complaintCategoryFilter} onValueChange={setComplaintCategoryFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      <SelectItem value="electrical">Electrical</SelectItem>
                      <SelectItem value="plumbing">Plumbing</SelectItem>
                      <SelectItem value="furniture">Furniture</SelectItem>
                      <SelectItem value="cleanliness">Cleanliness</SelectItem>
                      <SelectItem value="internet">Internet / Wi-Fi</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={complaintStatusFilter} onValueChange={setComplaintStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {filteredComplaints.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    No complaints match the filter criteria.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Complaint Title</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Student</TableHead>
                          <TableHead>Room</TableHead>
                          <TableHead>Reported Date</TableHead>
                          <TableHead>Department</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredComplaints.map(c => (
                          <TableRow key={c._id}>
                            <TableCell className="font-medium max-w-xs truncate" title={c.title}>
                              {c.title}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs capitalize">
                                {c.category}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              {c.user ? `${c.user.firstName} ${c.user.lastName}` : 'Student'}
                            </TableCell>
                            <TableCell className="text-xs font-mono">
                              {c.roomNumber ? `Rm ${c.roomNumber}` : 'N/A'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(c.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="text-xs capitalize text-muted-foreground">
                              {c.assignedDepartment || 'Unassigned'}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  c.status === 'pending'
                                    ? 'destructive'
                                    : c.status === 'in_progress'
                                    ? 'secondary'
                                    : c.status === 'resolved'
                                    ? 'default'
                                    : 'outline'
                                }
                                className="text-xs"
                              >
                                {c.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedComplaint(c);
                                  setComplaintUpdateData({
                                    status: c.status,
                                    assignedDepartment: c.assignedDepartment || 'maintenance',
                                    adminNotes: c.adminNotes || ''
                                  });
                                  setIsComplaintDialogOpen(true);
                                }}
                              >
                                Update Status
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

          {/* ===================== TAB 6: OUTPASSES ===================== */}
          <TabsContent value="outpasses" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">Digital Outpass Requests</CardTitle>
                    <CardDescription className="text-xs">
                      Review, approve, or reject student gate passes for off-campus leaves
                    </CardDescription>
                  </div>
                  <Badge variant="outline">
                    Showing {filteredOutpasses.length} of {outpasses.length} Requests
                  </Badge>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                    <Input
                      placeholder="Search pass code, student, destination..."
                      value={outpassSearch}
                      onChange={e => setOutpassSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  <Select value={outpassStatusFilter} onValueChange={setOutpassStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Outpasses</SelectItem>
                      <SelectItem value="pending">Pending Review</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="checked_out">Currently Outside</SelectItem>
                      <SelectItem value="returned">Returned</SelectItem>
                      <SelectItem value="overdue">Overdue Alerts</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {filteredOutpasses.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    No outpass records found matching the filter.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pass Code</TableHead>
                          <TableHead>Student</TableHead>
                          <TableHead>Destination</TableHead>
                          <TableHead>Departure</TableHead>
                          <TableHead>Expected Return</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredOutpasses.map(o => (
                          <TableRow key={o._id} className={o.isOverdue ? 'bg-destructive/5' : ''}>
                            <TableCell className="font-mono font-semibold text-xs text-foreground">
                              {o.passCode}
                            </TableCell>
                            <TableCell>
                              <div className="text-xs font-medium">
                                {o.student ? `${o.student.firstName} ${o.student.lastName}` : 'Student'}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                PRN: {o.student?.prn || 'N/A'} • Rm {o.student?.roomNumber || 'N/A'}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs max-w-xs truncate" title={o.destination}>
                              {o.destination}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(o.departureDate).toLocaleString(undefined, {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                              })}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(o.expectedReturnDate).toLocaleString(undefined, {
                                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                              })}
                            </TableCell>
                            <TableCell>
                              {o.isOverdue ? (
                                <Badge variant="destructive" className="text-xs font-bold animate-pulse">
                                  OVERDUE
                                </Badge>
                              ) : (
                                <Badge
                                  variant={
                                    o.status === 'pending'
                                      ? 'secondary'
                                      : o.status === 'approved'
                                      ? 'outline'
                                      : o.status === 'checked_out' || o.status === 'used'
                                      ? 'default'
                                      : o.status === 'returned'
                                      ? 'outline'
                                      : 'destructive'
                                  }
                                  className="text-xs"
                                >
                                  {o.status === 'checked_out' ? 'Outside' : o.status}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {o.status === 'pending' && (
                                  <>
                                    <Button
                                      size="sm"
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 px-2.5 text-xs"
                                      onClick={() => {
                                        setSelectedOutpass(o);
                                        setOutpassAction('approve');
                                        setOutpassRemarks('Approved by Warden');
                                        setIsOutpassDialogOpen(true);
                                      }}
                                    >
                                      Approve
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="h-8 px-2.5 text-xs"
                                      onClick={() => {
                                        setSelectedOutpass(o);
                                        setOutpassAction('reject');
                                        setOutpassRemarks('');
                                        setIsOutpassDialogOpen(true);
                                      }}
                                    >
                                      Reject
                                    </Button>
                                  </>
                                )}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-2.5 text-xs"
                                  onClick={() => {
                                    setSelectedOutpass(o);
                                    setOutpassAction('approve');
                                    setIsOutpassDialogOpen(true);
                                  }}
                                >
                                  Details
                                </Button>
                              </div>
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

          {/* ===================== TAB 7: GATE ACTIVITY ===================== */}
          <TabsContent value="gate" className="space-y-6">
            {/* Gate Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">Currently Outside</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-extrabold text-foreground">{currentlyOutsideOutpasses.length}</span>
                    <span className="text-xs text-muted-foreground">students checked out</span>
                  </div>
                </CardContent>
              </Card>

              <Card className={overdueOutpasses.length > 0 ? 'border-destructive/40 bg-destructive/5' : ''}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">Overdue Students</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline space-x-2">
                    <span className={`text-3xl font-extrabold ${overdueOutpasses.length > 0 ? 'text-destructive' : 'text-foreground'}`}>
                      {overdueOutpasses.length}
                    </span>
                    <span className="text-xs text-muted-foreground">passed expected return</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium text-muted-foreground">Returned Safely</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-extrabold text-emerald-600">
                      {outpasses.filter(o => o.status === 'returned').length}
                    </span>
                    <span className="text-xs text-muted-foreground">completed journeys</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Overdue Section */}
            {overdueOutpasses.length > 0 && (
              <Card className="border-destructive/50">
                <CardHeader className="bg-destructive/10">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-destructive" />
                    <CardTitle className="text-base text-destructive font-bold">
                      Immediate Attention: Overdue Students
                    </CardTitle>
                  </div>
                  <CardDescription className="text-xs">
                    These students have not returned within their permitted return window. Contact student and emergency contacts.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="divide-y divide-border">
                    {overdueOutpasses.map(o => (
                      <div key={o._id} className="py-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-sm">
                            {o.student?.firstName} {o.student?.lastName} (PRN: {o.student?.prn || 'N/A'})
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Pass Code: <span className="font-mono">{o.passCode}</span> • Destination: {o.destination}
                          </p>
                          <p className="text-xs text-destructive font-medium mt-1">
                            Expected Return was: {new Date(o.expectedReturnDate).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          {o.student?.phone && (
                            <span className="flex items-center gap-1 font-mono">
                              <Phone className="w-3.5 h-3.5 text-primary" /> {o.student.phone}
                            </span>
                          )}
                          {o.emergencyContact && (
                            <Badge variant="outline" className="font-mono">
                              Emergency: {o.emergencyContact}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Live Gate Transactions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Gate Checkouts & Check-ins</CardTitle>
                <CardDescription className="text-xs">
                  Official timestamp logs recorded by Security Gate staff
                </CardDescription>
              </CardHeader>
              <CardContent>
                {outpasses.filter(o => o.status !== 'pending' && o.status !== 'rejected').length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    No gate movement records recorded yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pass Code</TableHead>
                          <TableHead>Student</TableHead>
                          <TableHead>Room</TableHead>
                          <TableHead>Destination</TableHead>
                          <TableHead>Exit Timestamp</TableHead>
                          <TableHead>Return Timestamp</TableHead>
                          <TableHead>Verified By Gate Staff</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {outpasses
                          .filter(o => o.status !== 'pending' && o.status !== 'rejected')
                          .slice(0, 15)
                          .map(o => (
                            <TableRow key={o._id}>
                              <TableCell className="font-mono font-medium text-xs">{o.passCode}</TableCell>
                              <TableCell className="text-xs font-medium">
                                {o.student?.firstName} {o.student?.lastName}
                              </TableCell>
                              <TableCell className="text-xs font-mono">{o.student?.roomNumber || 'N/A'}</TableCell>
                              <TableCell className="text-xs max-w-xs truncate">{o.destination}</TableCell>
                              <TableCell className="text-xs">
                                {o.actualDepartureDate
                                  ? new Date(o.actualDepartureDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  : 'Not Exited'}
                              </TableCell>
                              <TableCell className="text-xs">
                                {o.actualReturnDate
                                  ? new Date(o.actualReturnDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  : o.status === 'checked_out'
                                  ? 'Currently Out'
                                  : '—'}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {o.checkedOutBy?.firstName
                                  ? `${o.checkedOutBy.firstName} (Gate Security)`
                                  : 'Security Officer'}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    o.isOverdue
                                      ? 'destructive'
                                      : o.status === 'returned'
                                      ? 'outline'
                                      : o.status === 'checked_out'
                                      ? 'default'
                                      : 'secondary'
                                  }
                                  className="text-xs"
                                >
                                  {o.isOverdue ? 'OVERDUE' : o.status}
                                </Badge>
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
        </Tabs>

        {/* ===================== DIALOG 1: ALLOCATION DIALOG ===================== */}
        <Dialog open={isAllocationDialogOpen} onOpenChange={setIsAllocationDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                Approve & Allocate Room: {selectedStudentForAllocation?.firstName} {selectedStudentForAllocation?.lastName}
              </DialogTitle>
              <DialogDescription>
                Assign a floor and room number in your hostel to approve this student's account.
              </DialogDescription>
            </DialogHeader>

            {selectedStudentForAllocation && (
              <div className="space-y-4 pt-2">
                <div className="p-3 rounded-lg bg-muted/40 text-xs space-y-1">
                  <p><span className="font-semibold">PRN:</span> {selectedStudentForAllocation.prn || 'N/A'}</p>
                  <p><span className="font-semibold">Email:</span> {selectedStudentForAllocation.email}</p>
                  <p><span className="font-semibold">Hostel:</span> {hostel?.name || selectedStudentForAllocation.hostel}</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="alloc-floor">Floor Number</Label>
                    <Input
                      id="alloc-floor"
                      type="number"
                      placeholder="e.g. 1"
                      value={allocationFloor}
                      onChange={e => setAllocationFloor(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="alloc-room">Room Number</Label>
                    <Input
                      id="alloc-room"
                      placeholder="e.g. 101"
                      value={allocationRoomNumber}
                      onChange={e => setAllocationRoomNumber(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsAllocationDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleApproveAndAllocate} className="bg-primary">
                    Confirm Room Allocation
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ===================== DIALOG 2: REJECT DIALOG ===================== */}
        <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-destructive">
                Reject Registration: {selectedStudentForReject?.firstName} {selectedStudentForReject?.lastName}
              </DialogTitle>
              <DialogDescription>
                Provide the formal reason for rejecting this student's hostel registration.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div>
                <Label htmlFor="rej-reason">Rejection Reason</Label>
                <Textarea
                  id="rej-reason"
                  placeholder="e.g. Ineligible for hostel accommodation or submitted invalid documents"
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={handleRejectStudent}>
                  Confirm Rejection
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ===================== DIALOG 3: COMPLAINT UPDATE DIALOG ===================== */}
        <Dialog open={isComplaintDialogOpen} onOpenChange={setIsComplaintDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Update Complaint: {selectedComplaint?.title}</DialogTitle>
              <DialogDescription>
                Assign maintenance department, update ticket progress, or add resolution notes.
              </DialogDescription>
            </DialogHeader>

            {selectedComplaint && (
              <div className="space-y-4 pt-2">
                <div className="p-3 rounded-lg bg-muted/40 text-xs space-y-1">
                  <p><span className="font-semibold">Description:</span> {selectedComplaint.description}</p>
                  <p><span className="font-semibold">Student:</span> {selectedComplaint.user?.firstName} {selectedComplaint.user?.lastName} (PRN: {selectedComplaint.user?.prn || 'N/A'})</p>
                  <p><span className="font-semibold">Location:</span> Room {selectedComplaint.roomNumber || 'N/A'}</p>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="comp-status">Status</Label>
                    <Select
                      value={complaintUpdateData.status}
                      onValueChange={val => setComplaintUpdateData(prev => ({ ...prev, status: val }))}
                    >
                      <SelectTrigger id="comp-status">
                        <SelectValue placeholder="Select Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="comp-dept">Department</Label>
                    <Select
                      value={complaintUpdateData.assignedDepartment}
                      onValueChange={val => setComplaintUpdateData(prev => ({ ...prev, assignedDepartment: val }))}
                    >
                      <SelectTrigger id="comp-dept">
                        <SelectValue placeholder="Assign Department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="electrical">Electrical</SelectItem>
                        <SelectItem value="plumbing">Plumbing</SelectItem>
                        <SelectItem value="cleaning">Cleaning</SelectItem>
                        <SelectItem value="security">Security</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="comp-notes">Warden Resolution Notes</Label>
                    <Textarea
                      id="comp-notes"
                      placeholder="Add details regarding electrician visit, parts replaced, or resolution status..."
                      value={complaintUpdateData.adminNotes}
                      onChange={e => setComplaintUpdateData(prev => ({ ...prev, adminNotes: e.target.value }))}
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setIsComplaintDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpdateComplaint}>
                    Save Changes
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ===================== DIALOG 4: OUTPASS DIALOG ===================== */}
        <Dialog open={isOutpassDialogOpen} onOpenChange={setIsOutpassDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {outpassAction === 'approve' ? 'Review & Approve Outpass' : 'Reject Outpass'}
              </DialogTitle>
              <DialogDescription>
                Pass Code: <span className="font-mono font-semibold">{selectedOutpass?.passCode}</span>
              </DialogDescription>
            </DialogHeader>

            {selectedOutpass && (
              <div className="space-y-4 pt-2">
                <div className="p-3 rounded-lg bg-muted/40 text-xs space-y-1.5">
                  <p><span className="font-semibold">Student:</span> {selectedOutpass.student?.firstName} {selectedOutpass.student?.lastName} (PRN: {selectedOutpass.student?.prn || 'N/A'})</p>
                  <p><span className="font-semibold">Destination:</span> {selectedOutpass.destination}</p>
                  <p><span className="font-semibold">Reason:</span> {selectedOutpass.reason}</p>
                  <p><span className="font-semibold">Departure:</span> {new Date(selectedOutpass.departureDate).toLocaleString()}</p>
                  <p><span className="font-semibold">Expected Return:</span> {new Date(selectedOutpass.expectedReturnDate).toLocaleString()}</p>
                  <p><span className="font-semibold">Student Phone:</span> {selectedOutpass.student?.phone || 'N/A'}</p>
                  <p><span className="font-semibold">Emergency Contact:</span> {selectedOutpass.emergencyContact || 'N/A'}</p>
                </div>

                <div>
                  <Label htmlFor="outpass-remarks">Warden Remarks</Label>
                  <Textarea
                    id="outpass-remarks"
                    placeholder={outpassAction === 'approve' ? 'e.g. Verified with parent. Approved.' : 'Specify reason for rejection...'}
                    value={outpassRemarks}
                    onChange={e => setOutpassRemarks(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setIsOutpassDialogOpen(false)}>
                    Close
                  </Button>
                  {outpassAction === 'approve' ? (
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={handleApproveOutpass}
                      disabled={isProcessingOutpass}
                    >
                      {isProcessingOutpass ? 'Approving...' : 'Approve Outpass'}
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      onClick={handleRejectOutpass}
                      disabled={isProcessingOutpass}
                    >
                      {isProcessingOutpass ? 'Rejecting...' : 'Reject Outpass'}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ===================== DIALOG 5: STUDENT DETAIL MODAL ===================== */}
        <Dialog open={isStudentDetailOpen} onOpenChange={setIsStudentDetailOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Student Profile</DialogTitle>
            </DialogHeader>

            {selectedStudentDetail && (
              <div className="space-y-3 pt-2 text-sm">
                <div className="flex items-center gap-3 pb-3 border-b border-border">
                  <div className="w-12 h-12 rounded-full gradient-primary flex items-center justify-center text-white font-bold text-lg">
                    {selectedStudentDetail.firstName[0]}
                  </div>
                  <div>
                    <h3 className="font-bold text-base">{selectedStudentDetail.firstName} {selectedStudentDetail.lastName}</h3>
                    <p className="text-xs text-muted-foreground font-mono">PRN: {selectedStudentDetail.prn || 'N/A'}</p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <p><span className="text-muted-foreground">Email:</span> {selectedStudentDetail.email}</p>
                  <p><span className="text-muted-foreground">Phone:</span> {selectedStudentDetail.phone || 'N/A'}</p>
                  <p><span className="text-muted-foreground">Hostel:</span> {selectedStudentDetail.hostel || hostel?.name}</p>
                  <p><span className="text-muted-foreground">Room:</span> {selectedStudentDetail.roomNumber ? `Room ${selectedStudentDetail.roomNumber} (Floor ${selectedStudentDetail.floor || '1'})` : 'Unassigned'}</p>
                  <p><span className="text-muted-foreground">Status:</span> <Badge variant="outline">{selectedStudentDetail.status}</Badge></p>
                </div>

                <div className="flex justify-end pt-4">
                  <Button variant="outline" onClick={() => setIsStudentDetailOpen(false)}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
};

export default WardenDashboard;