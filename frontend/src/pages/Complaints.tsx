import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Navigation } from '@/components/ui/navigation';
import Footer from '@/components/ui/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertCircle,
  Clock,
  CheckCircle,
  Plus,
  FileText,
  XCircle,
  Loader2,
  Shield,
  Trash2,
  Edit,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { authenticatedFetch, API_ENDPOINTS } from '@/lib/api-config';

interface Complaint {
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
  user?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    prn?: string;
  };
}

const Complaints: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [adminStatusFilter, setAdminStatusFilter] = useState('all');

  // Admin update dialog state
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateData, setUpdateData] = useState({
    status: '',
    assignedDepartment: '',
    adminNotes: '',
  });

  useEffect(() => {
    if (isLoading) return;
    const complaintId = searchParams.get('complaintId');
    if (complaintId) {
      const found = complaints.find(c => String(c._id) === complaintId);
      if (found) {
        setSelectedComplaint(found);
        setIsUpdateDialogOpen(true);
      } else {
        toast({
          title: 'Not Found',
          description: 'This item is no longer available.',
          variant: 'destructive',
        });
      }
    }
  }, [isLoading, searchParams, complaints]);

  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    category?: string;
  }>({
    title: '',
    description: '',
    category: undefined,
  });

  const { toast } = useToast();
  const { isAdmin, user } = useAuth();

  useEffect(() => {
    if (isAdmin) {
      fetchAdminComplaints();
    } else {
      fetchMyComplaints();
    }
  }, [isAdmin]);

  const fetchMyComplaints = async () => {
    try {
      setIsLoading(true);
      const response = await authenticatedFetch(API_ENDPOINTS.COMPLAINTS_MY);
      const data = await response.json();
      setComplaints(data.data || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load complaints',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAdminComplaints = async () => {
    try {
      setIsLoading(true);
      const response = await authenticatedFetch(API_ENDPOINTS.ADMIN_COMPLAINTS);
      const data = await response.json();
      setComplaints(data.data || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load all complaints',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplaintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category) {
      toast({
        title: 'Category Required',
        description: 'Please select a complaint category.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authenticatedFetch(
        API_ENDPOINTS.COMPLAINTS_CREATE,
        {
          method: 'POST',
          body: JSON.stringify(formData),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: 'Complaint Submitted',
          description: 'Your complaint has been submitted successfully',
        });

        setFormData({
          title: '',
          description: '',
          category: undefined,
        });

        fetchMyComplaints();
      } else {
        toast({
          title: 'Submission Failed',
          description: data.message || 'Failed to submit complaint',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not connect to server',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openUpdateDialog = (complaint: Complaint) => {
    setSelectedComplaint(complaint);
    setUpdateData({
      status: complaint.status || 'pending',
      assignedDepartment: complaint.assignedDepartment || 'none',
      adminNotes: complaint.adminNotes || '',
    });
    setIsUpdateDialogOpen(true);
  };

  const handleUpdateComplaint = async () => {
    if (!selectedComplaint) return;
    setIsUpdating(true);
    try {
      const response = await authenticatedFetch(
        API_ENDPOINTS.ADMIN_COMPLAINT_UPDATE(selectedComplaint._id),
        {
          method: 'PATCH',
          body: JSON.stringify(updateData),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: 'Complaint Updated',
          description: 'Status and assignment saved successfully.',
        });
        setIsUpdateDialogOpen(false);
        fetchAdminComplaints();
      } else {
        toast({
          title: 'Update Failed',
          description: data.message || 'Could not update complaint',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update complaint on server.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteComplaint = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this complaint? This cannot be undone.')) {
      return;
    }

    try {
      const response = await authenticatedFetch(
        API_ENDPOINTS.ADMIN_COMPLAINT_DELETE(id),
        { method: 'DELETE' }
      );
      if (response.ok) {
        toast({
          title: 'Deleted',
          description: 'Complaint removed successfully.',
        });
        fetchAdminComplaints();
      } else {
        const data = await response.json();
        toast({
          title: 'Delete Failed',
          description: data.message || 'Unable to delete complaint.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Server error while deleting complaint.',
        variant: 'destructive',
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-amber-500" />;
      case 'in_progress':
        return <AlertCircle className="w-4 h-4 text-blue-500" />;
      case 'resolved':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'rejected':
        return <XCircle className="w-4 h-4 text-destructive" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'pending':
        return 'secondary';
      case 'in_progress':
        return 'default';
      case 'resolved':
        return 'outline';
      case 'rejected':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const formatStatus = (status: string) =>
    (status || 'pending')
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

  const formatDepartment = (dept: string) =>
    !dept || dept === 'none'
      ? 'Not Assigned'
      : dept.charAt(0).toUpperCase() + dept.slice(1);

  // Filter complaints for admin view
  const filteredAdminComplaints = complaints.filter((c) => {
    if (adminStatusFilter === 'all') return true;
    return c.status === adminStatusFilter;
  });

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="container mx-auto px-4 py-10">
        {/* ================= ADMIN & WARDEN COMPLAINT PORTAL ================= */}
        {isAdmin ? (
          <div>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-6 h-6 text-primary" />
                  <h1 className="text-3xl font-bold">Complaints Management</h1>
                </div>
                <p className="text-muted-foreground">
                  Review, assign, and resolve student maintenance and facility requests across all hostels.
                </p>
              </div>
              <Button asChild variant="outline">
                <Link to="/admin/dashboard" className="flex items-center gap-2">
                  <span>Go to Admin Dashboard</span>
                  <ExternalLink className="w-4 h-4" />
                </Link>
              </Button>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{complaints.length}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-amber-500">Pending</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-500">
                    {complaints.filter((c) => c.status === 'pending').length}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-blue-500">In Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-500">
                    {complaints.filter((c) => c.status === 'in_progress').length}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-emerald-500">Resolved</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-500">
                    {complaints.filter((c) => c.status === 'resolved').length}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-2 mb-6">
              {[
                { key: 'all', label: 'All Complaints' },
                { key: 'pending', label: 'Pending' },
                { key: 'in_progress', label: 'In Progress' },
                { key: 'resolved', label: 'Resolved' },
                { key: 'rejected', label: 'Rejected' },
              ].map((f) => (
                <Button
                  key={f.key}
                  variant={adminStatusFilter === f.key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAdminStatusFilter(f.key)}
                >
                  {f.label}
                </Button>
              ))}
            </div>

            {isLoading ? (
              <div className="flex justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredAdminComplaints.length === 0 ? (
              <Card className="text-center p-12">
                <p className="text-muted-foreground">No complaints found for this filter.</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredAdminComplaints.map((c) => (
                  <Card key={c._id} className="shadow-sm hover:shadow transition">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{c.title}</CardTitle>
                          <CardDescription>
                            {c.hostel || 'Hostel'} — Room {c.roomNumber || 'N/A'} (Floor {c.floor || 'N/A'})
                          </CardDescription>
                        </div>
                        <Badge variant={getStatusVariant(c.status)} className="flex items-center gap-1">
                          {getStatusIcon(c.status)}
                          <span>{formatStatus(c.status)}</span>
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm text-foreground/90 whitespace-pre-wrap">{c.description}</p>
                      <div className="text-xs text-muted-foreground grid grid-cols-2 gap-2 pt-2 border-t">
                        <div>
                          <strong>Student:</strong> {c.user?.firstName ? `${c.user.firstName} ${c.user.lastName || ''}` : 'Student'} ({c.user?.prn || 'N/A'})
                        </div>
                        <div>
                          <strong>Category:</strong> <span className="capitalize">{c.category || 'General'}</span>
                        </div>
                        <div>
                          <strong>Dept:</strong> {formatDepartment(c.assignedDepartment)}
                        </div>
                        <div>
                          <strong>Date:</strong> {new Date(c.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      {c.adminNotes && (
                        <div className="text-xs bg-muted/60 p-2 rounded">
                          <strong>Admin Note:</strong> {c.adminNotes}
                        </div>
                      )}
                      <div className="flex justify-end gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openUpdateDialog(c)}
                          className="flex items-center gap-1"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Update Status</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteComplaint(c._id)}
                          className="flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* Admin Update Dialog */}
            <Dialog open={isUpdateDialogOpen} onOpenChange={setIsUpdateDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Update Complaint Status</DialogTitle>
                  <DialogDescription>
                    Assign department or resolve the student maintenance complaint.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={updateData.status}
                      onValueChange={(v) => setUpdateData({ ...updateData, status: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Assigned Department</Label>
                    <Select
                      value={updateData.assignedDepartment}
                      onValueChange={(v) => setUpdateData({ ...updateData, assignedDepartment: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="cleaning">Cleaning</SelectItem>
                        <SelectItem value="electrical">Electrical</SelectItem>
                        <SelectItem value="plumbing">Plumbing</SelectItem>
                        <SelectItem value="security">Security</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Admin Notes</Label>
                    <Textarea
                      placeholder="Add internal or resolution notes for the student..."
                      value={updateData.adminNotes}
                      onChange={(e) => setUpdateData({ ...updateData, adminNotes: e.target.value })}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsUpdateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpdateComplaint} disabled={isUpdating}>
                    {isUpdating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Save Changes
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          /* ================= STUDENT COMPLAINT PORTAL ================= */
          <div>
            <h1 className="text-3xl font-bold mb-6">Complaint Management</h1>

            <Tabs defaultValue="new">
              <TabsList>
                <TabsTrigger value="new">
                  <Plus className="w-4 h-4 mr-1" /> New Complaint
                </TabsTrigger>
                <TabsTrigger value="list">
                  <FileText className="w-4 h-4 mr-1" /> My Complaints
                </TabsTrigger>
              </TabsList>

              {/* ================= NEW COMPLAINT ================= */}
              <TabsContent value="new">
                <Card>
                  <CardHeader>
                    <CardTitle>Submit Complaint</CardTitle>
                    <CardDescription>
                      Report hostel or room issues. Location is automatically bound to your assigned room.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleComplaintSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Category</Label>
                        <Select
                          value={formData.category}
                          onValueChange={(v) =>
                            setFormData({ ...formData, category: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="maintenance">Maintenance</SelectItem>
                            <SelectItem value="food">Food</SelectItem>
                            <SelectItem value="security">Security</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Read-only assignment — sourced from the authenticated user's profile */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Hostel</Label>
                          <Input
                            value={user?.hostel ? `${user.hostel.charAt(0).toUpperCase() + user.hostel.slice(1)} Hostel` : 'Not assigned'}
                            readOnly
                            className="bg-muted/50"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Floor</Label>
                          <Input
                            value={user?.floor?.toString() ?? 'Not assigned'}
                            readOnly
                            className="bg-muted/50"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Room Number</Label>
                          <Input
                            value={user?.roomNumber?.toString() ?? 'Not assigned'}
                            readOnly
                            className="bg-muted/50"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Input
                          placeholder="Brief summary of the issue"
                          value={formData.title}
                          onChange={(e) =>
                            setFormData({ ...formData, title: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          placeholder="Provide detailed description of the issue..."
                          value={formData.description}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              description: e.target.value,
                            })
                          }
                          rows={4}
                          required
                        />
                      </div>

                      <Button disabled={isSubmitting}>
                        {isSubmitting ? (
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        ) : null}
                        Submit Complaint
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ================= MY COMPLAINTS LIST ================= */}
              <TabsContent value="list">
                {isLoading ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : complaints.length === 0 ? (
                  <Card className="text-center p-8">
                    <p className="text-muted-foreground">You have not submitted any complaints yet.</p>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {complaints.map((c) => (
                      <Card key={c._id}>
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle>{c.title}</CardTitle>
                              <CardDescription>
                                Submitted on {new Date(c.createdAt).toLocaleDateString()}
                              </CardDescription>
                            </div>
                            <Badge variant={getStatusVariant(c.status)} className="flex items-center gap-1">
                              {getStatusIcon(c.status)}
                              <span>{formatStatus(c.status)}</span>
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <p className="text-sm text-foreground/90 whitespace-pre-wrap">{c.description}</p>
                          <div className="text-xs text-muted-foreground flex flex-wrap gap-4 pt-2 border-t">
                            <span><strong>Hostel:</strong> {c.hostel || 'N/A'}</span>
                            <span><strong>Room:</strong> {c.roomNumber || 'N/A'}</span>
                            <span><strong>Category:</strong> <span className="capitalize">{c.category}</span></span>
                            <span><strong>Department:</strong> {formatDepartment(c.assignedDepartment)}</span>
                          </div>
                          {c.adminNotes && (
                            <div className="text-xs bg-muted/60 p-2.5 rounded mt-2">
                              <strong>Warden/Admin Response:</strong> {c.adminNotes}
                            </div>
                          )}
                          <div className="flex justify-end pt-2">
                            <Link to={`/complaints/${c._id}`} className="text-xs text-primary hover:underline">
                              View Details →
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default Complaints;
