import React, { useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Navigation } from "@/components/ui/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Users, Home, DoorOpen, CheckCircle, AlertCircle, FileText,
  Loader2, LogOut, QrCode, ArrowRightLeft, RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authenticatedFetch, API_ENDPOINTS } from "@/lib/api-config";
import { useAuth } from "@/contexts/AuthContext";

interface SecurityStats {
  totalStudents: number;
  onCampus: number;
  currentlyOut: number;
  returned: number;
  overdue: number;
  approvedLeave: number;
  pendingRequests: number;
}

interface GateMovement {
  id: string;
  passCode: string;
  studentName: string;
  prn: string;
  hostel: string;
  roomNumber: string;
  destination: string;
  date: string;
  outTime: string;
  expectedReturn: string;
  returnTime: string;
  status: string;
  verifiedBy: string;
}

interface Hostel {
  _id: string;
  name: string;
}

const SecurityDashboard: React.FC = () => {
  const { user, isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [movements, setMovements] = useState<GateMovement[]>([]);
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().split("T")[0]);
  const [hostelFilter, setHostelFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Gate operation state
  const [passCodeInput, setPassCodeInput] = useState("");
  const [gateAction, setGateAction] = useState<"checkout" | "return">("checkout");
  const [gateLoading, setGateLoading] = useState(false);
  const [gateResult, setGateResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchHostels = useCallback(async () => {
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.HOSTELS);
      if (res.ok) {
        const data = await res.json();
        setHostels(data.data || []);
      }
    } catch {
      // non-critical
    }
  }, []);

  const fetchSecurityData = useCallback(async () => {
    try {
      const res = await authenticatedFetch(
        `${API_ENDPOINTS.SECURITY_GATE_ATTENDANCE}?date=${dateFilter}&hostel=${hostelFilter}&status=${statusFilter}`
      );
      if (res.ok) {
        const data = await res.json();
        setStats(data.data.summary);
        setMovements(data.data.movements);
      } else {
        toast({ title: "Error", description: "Failed to load gate data", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to load gate attendance data", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [dateFilter, hostelFilter, statusFilter, toast]);

  useEffect(() => {
    fetchSecurityData();
  }, [fetchSecurityData]);

  useEffect(() => {
    fetchHostels();
  }, [fetchHostels]);

  const handleGateOperation = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = passCodeInput.trim().toUpperCase();
    if (!code) return;
    setGateLoading(true);
    setGateResult(null);
    try {
      const endpoint =
        gateAction === "checkout" ? API_ENDPOINTS.SECURITY_CHECKOUT : API_ENDPOINTS.SECURITY_RETURN;
      const res = await authenticatedFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ passCode: code }),
      });
      const data = await res.json();
      setGateResult({ success: res.ok && data.success, message: data.message || "Unknown error" });
      if (res.ok && data.success) {
        setPassCodeInput("");
        // Refresh attendance after gate operation
        fetchSecurityData();
      }
    } catch {
      setGateResult({ success: false, message: "Network error. Please retry." });
    } finally {
      setGateLoading(false);
    }
  };

  // --- Auth guards ---
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  if (!isAuthenticated || !user) { navigate("/login"); return null; }
  if (user.role !== "security") { navigate("/"); return null; }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading security dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold gradient-primary bg-clip-text text-transparent">
            Security Dashboard
          </h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchSecurityData}>
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
          </div>
        </div>

        <Tabs defaultValue="gate">
          <TabsList className="mb-6">
            <TabsTrigger value="gate">
              <QrCode className="w-4 h-4 mr-2" /> Gate Operations
            </TabsTrigger>
            <TabsTrigger value="attendance">
              <ArrowRightLeft className="w-4 h-4 mr-2" /> Gate Attendance
            </TabsTrigger>
          </TabsList>

          {/* ===== GATE OPERATIONS TAB ===== */}
          <TabsContent value="gate">
            {/* Stats row */}
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
                {[
                  { label: "Total Students", value: stats.totalStudents, icon: <Users className="w-4 h-4 text-primary" /> },
                  { label: "On Campus", value: stats.onCampus, icon: <Home className="w-4 h-4 text-success" /> },
                  { label: "Currently Out", value: stats.currentlyOut, icon: <DoorOpen className="w-4 h-4 text-warning" /> },
                  { label: "Returned Today", value: stats.returned, icon: <CheckCircle className="w-4 h-4 text-primary" /> },
                  { label: "Overdue", value: stats.overdue, icon: <AlertCircle className="w-4 h-4 text-destructive" /> },
                  { label: "Approved Leave", value: stats.approvedLeave, icon: <FileText className="w-4 h-4 text-primary" /> },
                ].map((s) => (
                  <Card key={s.label} className="shadow-card">
                    <CardHeader className="pb-1">
                      <CardTitle className="text-xs font-medium text-muted-foreground">{s.label}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center space-x-2">
                        {s.icon}
                        <span className="text-2xl font-bold">{s.value}</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Gate CHECK OUT / CHECK IN form */}
            <Card className="shadow-card max-w-lg mx-auto">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="w-5 h-5" /> Gate Pass Verification
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleGateOperation} className="space-y-4">
                  {/* Action selector */}
                  <div className="space-y-1">
                    <Label>Gate Action</Label>
                    <Select value={gateAction} onValueChange={(v) => setGateAction(v as "checkout" | "return")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="checkout">Check OUT (Student Leaving)</SelectItem>
                        <SelectItem value="return">Check IN (Student Returning)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Pass code input */}
                  <div className="space-y-1">
                    <Label htmlFor="passCode">Pass Code / QR Code</Label>
                    <Input
                      id="passCode"
                      placeholder="Scan QR or type pass code e.g. OP-7F3A29B0"
                      value={passCodeInput}
                      onChange={(e) => {
                        setPassCodeInput(e.target.value.toUpperCase());
                        setGateResult(null);
                      }}
                      className="font-mono"
                      autoFocus
                    />
                    <p className="text-xs text-muted-foreground">
                      Tip: Pass codes are printed on student QR passes (format: OP-XXXXXXXX).
                    </p>
                  </div>

                  <Button
                    type="submit"
                    disabled={gateLoading || !passCodeInput.trim()}
                    className={`w-full font-bold ${gateAction === "checkout" ? "bg-emerald-700 hover:bg-emerald-800 text-white" : "bg-blue-700 hover:bg-blue-800 text-white"}`}
                  >
                    {gateLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Processing...</>
                    ) : gateAction === "checkout" ? (
                      <><DoorOpen className="w-4 h-4 mr-2" /> RECORD DEPARTURE (CHECK OUT)</>
                    ) : (
                      <><CheckCircle className="w-4 h-4 mr-2" /> RECORD RETURN (CHECK IN)</>
                    )}
                  </Button>

                  {/* Result feedback */}
                  {gateResult && (
                    <div
                      className={`p-3 rounded-lg text-sm font-medium text-center ${
                        gateResult.success
                          ? "bg-emerald-50 border border-emerald-400 text-emerald-900"
                          : "bg-rose-50 border border-rose-400 text-rose-900"
                      }`}
                    >
                      {gateResult.success ? "✅ " : "❌ "}
                      {gateResult.message}
                    </div>
                  )}
                </form>

                <div className="mt-4 pt-4 border-t text-center">
                  <Link to="/outpass/verify-qr" className="text-sm text-primary hover:underline">
                    Open full QR scanner / verification view →
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== GATE ATTENDANCE TAB ===== */}
          <TabsContent value="attendance">
            {/* Filters */}
            <Card className="shadow-card mb-6">
              <CardHeader>
                <CardTitle>Gate Activity Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="date-filter">Date</Label>
                    <Input
                      type="date"
                      id="date-filter"
                      value={dateFilter}
                      onChange={(e) => setDateFilter(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Hostel</Label>
                    <Select value={hostelFilter} onValueChange={setHostelFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Hostels" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Hostels</SelectItem>
                        {hostels.map((h) => (
                          <SelectItem key={h._id} value={h.name}>{h.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Status</Label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="checked_out">Currently Out</SelectItem>
                        <SelectItem value="returned">Returned</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <Button variant="outline" onClick={fetchSecurityData}>
                    <RefreshCw className="w-4 h-4 mr-2" /> Apply Filters
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Movements table */}
            <Card className="shadow-card">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Gate Movements</CardTitle>
                <Button variant="outline" size="sm" onClick={fetchSecurityData}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {movements.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    No gate movements found for the selected filters.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pass Code</TableHead>
                        <TableHead>Student</TableHead>
                        <TableHead>Hostel / Room</TableHead>
                        <TableHead>Destination</TableHead>
                        <TableHead>Out Time</TableHead>
                        <TableHead>Expected Return</TableHead>
                        <TableHead>Return Time</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Verified By</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {movements.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="font-mono text-xs">{m.passCode}</TableCell>
                          <TableCell>
                            <div className="font-medium">{m.studentName}</div>
                            <div className="text-xs text-muted-foreground">PRN: {m.prn}</div>
                          </TableCell>
                          <TableCell>
                            <div>{m.hostel}</div>
                            <div className="text-xs text-muted-foreground">Room {m.roomNumber}</div>
                          </TableCell>
                          <TableCell className="max-w-[140px] truncate" title={m.destination}>
                            {m.destination}
                          </TableCell>
                          <TableCell>{m.outTime}</TableCell>
                          <TableCell>{m.expectedReturn}</TableCell>
                          <TableCell>{m.returnTime === "—" ? "" : m.returnTime}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                m.status === "CURRENTLY OUT" ? "outline"
                                  : m.status === "RETURNED" ? "default"
                                  : m.status === "OVERDUE" ? "destructive"
                                  : "secondary"
                              }
                            >
                              {m.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{m.verifiedBy}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SecurityDashboard;
