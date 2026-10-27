import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Navigation } from '@/components/ui/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react';
import { authenticatedFetch, API_ENDPOINTS } from '@/lib/api-config';
import { useAuth } from '@/contexts/AuthContext';

interface ComplaintData {
  _id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  hostel: string;
  floor: string;
  roomNumber: string;
  assignedDepartment?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt?: string;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
    prn?: string;
  };
}

const statusVariant = (s: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (s === 'resolved') return 'default';
  if (s === 'in_progress') return 'secondary';
  if (s === 'rejected') return 'destructive';
  return 'outline';
};

const ComplaintDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [complaint, setComplaint] = useState<ComplaintData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) { setError('No complaint ID in URL.'); setLoading(false); return; }
    const fetchComplaint = async () => {
      try {
        // Try the student's own complaint endpoint first, fall back to admin endpoint
        const res = await authenticatedFetch(`/complaints/${id}`);
        if (res.status === 404) {
          setError('Complaint not found.');
        } else if (res.ok) {
          const data = await res.json();
          setComplaint(data.data || data);
        } else {
          const data = await res.json().catch(() => ({}));
          setError(data.message || 'Failed to load complaint.');
        }
      } catch {
        setError('Could not connect to server.');
      } finally {
        setLoading(false);
      }
    };
    fetchComplaint();
  }, [id]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  if (error || !complaint) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="container mx-auto px-4 py-16 text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-xl font-semibold">{error || 'Complaint not found'}</h2>
          <Button onClick={() => navigate('/complaints')} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Complaints
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Button variant="ghost" onClick={() => navigate('/complaints')} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Complaints
        </Button>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold gradient-primary bg-clip-text text-transparent">
              {complaint.title}
            </h1>
            <p className="text-muted-foreground mt-1">
              {complaint.hostel || 'Hostel N/A'} — Floor {complaint.floor || 'N/A'}, Room {complaint.roomNumber || 'N/A'}
            </p>
          </div>
          <Badge variant={statusVariant(complaint.status)} className="capitalize ml-4 mt-1 shrink-0">
            {complaint.status.replace('_', ' ')}
          </Badge>
        </div>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Complaint Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-muted-foreground">Category:</span> <span className="capitalize font-medium">{complaint.category}</span></div>
              <div><span className="text-muted-foreground">Submitted:</span> <span className="font-medium">{new Date(complaint.createdAt).toLocaleString()}</span></div>
              {complaint.assignedDepartment && (
                <div><span className="text-muted-foreground">Assigned Dept:</span> <span className="capitalize font-medium">{complaint.assignedDepartment}</span></div>
              )}
              {complaint.updatedAt && (
                <div><span className="text-muted-foreground">Last Updated:</span> <span className="font-medium">{new Date(complaint.updatedAt).toLocaleString()}</span></div>
              )}
            </div>
            <Separator />
            <div>
              <p className="text-muted-foreground mb-1 font-medium">Description</p>
              <p className="whitespace-pre-wrap">{complaint.description}</p>
            </div>
            {complaint.adminNotes && (
              <>
                <Separator />
                <div>
                  <p className="text-muted-foreground mb-1 font-medium">Warden / Admin Response</p>
                  <div className="bg-muted/50 p-3 rounded">{complaint.adminNotes}</div>
                </div>
              </>
            )}
            {complaint.user && (
              <>
                <Separator />
                <div className="text-xs text-muted-foreground">
                  Submitted by: {complaint.user.firstName} {complaint.user.lastName}
                  {complaint.user.prn ? ` (PRN: ${complaint.user.prn})` : ''}
                  {' '}— {complaint.user.email}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ComplaintDetail;
