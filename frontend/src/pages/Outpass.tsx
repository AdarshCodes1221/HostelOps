import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Navigation } from '@/components/ui/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { authenticatedFetch, API_ENDPOINTS } from '@/lib/api-config';
import { useAuth } from '@/contexts/AuthContext';
import {
  QrCode,
  Calendar,
  Clock,
  MapPin,
  Phone,
  ShieldCheck,
  AlertCircle,
  Plus,
  Loader2,
  CheckCircle2,
  XCircle,
  Printer,
} from 'lucide-react';

interface OutpassItem {
  _id: string;
  hostel: string;
  roomNumber: string;
  reason: string;
  category: string;
  destination: string;
  departureDate: string;
  expectedReturnDate: string;
  emergencyContact: string;
  parentContact?: string;
  status: 'pending' | 'approved' | 'rejected' | 'used' | 'expired';
  adminRemarks?: string;
  passCode?: string;
  qrCodeDataUri?: string;
  approvedAt?: string;
  createdAt: string;
}

const Outpass: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [outpasses, setOutpasses] = useState<OutpassItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPass, setSelectedPass] = useState<OutpassItem | null>(null);

  useEffect(() => {
    if (isLoading) return;
    const outpassId = searchParams.get('outpassId');
    if (outpassId) {
      const found = outpasses.find(p => String(p._id) === outpassId || p.passCode === outpassId);
      if (found) {
        setSelectedPass(found);
      } else {
        toast({
          title: 'Not Found',
          description: 'This item is no longer available.',
          variant: 'destructive',
        });
      }
    }
  }, [isLoading, searchParams, outpasses, toast]);

  // Form State
  const [reason, setReason] = useState('');
  const [category, setCategory] = useState('home');
  const [destination, setDestination] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [emergencyContact, setEmergencyContact] = useState(user?.phone || '');
  const [parentContact, setParentContact] = useState(user?.emergencyContact || '');

  const fetchMyOutpasses = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await authenticatedFetch(API_ENDPOINTS.OUTPASS_MY);
      const data = await res.json();
      if (res.ok && data.success) {
        setOutpasses(data.data || []);
      } else {
        toast({
          title: 'Error loading outpasses',
          description: data.message || 'Could not fetch your outpass records.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Network Error',
        description: 'Failed to connect to server.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMyOutpasses();
  }, [fetchMyOutpasses]);

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || !destination.trim() || !departureDate || !expectedReturnDate || !emergencyContact.trim()) {
      toast({
        title: 'Missing Fields',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    if (new Date(expectedReturnDate) <= new Date(departureDate)) {
      toast({
        title: 'Invalid Dates',
        description: 'Expected return time must be after departure time.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.OUTPASS_CREATE, {
        method: 'POST',
        body: JSON.stringify({
          reason: reason.trim(),
          category,
          destination: destination.trim(),
          departureDate,
          expectedReturnDate,
          emergencyContact: emergencyContact.trim(),
          parentContact: parentContact.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast({
          title: 'Outpass Submitted',
          description: 'Your request has been forwarded to hostel administration for approval.',
        });
        setIsDialogOpen(false);
        setReason('');
        setDestination('');
        setDepartureDate('');
        setExpectedReturnDate('');
        fetchMyOutpasses();
      } else {
        toast({
          title: 'Submission Failed',
          description: data.message || 'Unable to submit outpass request.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Connection Error',
        description: 'Failed to connect to backend server.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: OutpassItem['status']) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'used':
        return <Badge variant="secondary">Used / Closed</Badge>;
      case 'expired':
        return <Badge variant="outline" className="text-gray-500 border-gray-400">Expired</Badge>;
      case 'pending':
      default:
        return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Pending Approval</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation />

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <QrCode className="w-8 h-8 text-blue-600" />
              Digital Gate Pass & Outpass
            </h1>
            <p className="text-slate-600 text-sm mt-1">
              Apply for hostel exit permission and access your verified digital QR gate pass.
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-md flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Apply for Outpass
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>New Outpass Request</DialogTitle>
                <DialogDescription>
                  Hostel exit requires warden / admin authorization. Please fill all fields accurately.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleApply} className="space-y-4 pt-2">
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="home">Home Visit</SelectItem>
                      <SelectItem value="medical">Medical / Hospital</SelectItem>
                      <SelectItem value="academic">Academic / Project Work</SelectItem>
                      <SelectItem value="emergency">Family Emergency</SelectItem>
                      <SelectItem value="market">Market / Local Errands</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="destination">Destination City / Location *</Label>
                  <Input
                    id="destination"
                    placeholder="e.g. Pune Station / Mumbai Home"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="departureDate">Departure Date & Time *</Label>
                    <Input
                      id="departureDate"
                      type="datetime-local"
                      value={departureDate}
                      onChange={(e) => setDepartureDate(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="expectedReturnDate">Return Date & Time *</Label>
                    <Input
                      id="expectedReturnDate"
                      type="datetime-local"
                      value={expectedReturnDate}
                      onChange={(e) => setExpectedReturnDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="emergencyContact">Your Contact Phone *</Label>
                  <Input
                    id="emergencyContact"
                    placeholder="10-digit mobile number"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="parentContact">Parent / Guardian Contact</Label>
                  <Input
                    id="parentContact"
                    placeholder="Parent mobile number"
                    value={parentContact}
                    onChange={(e) => setParentContact(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="reason">Detailed Reason *</Label>
                  <Textarea
                    id="reason"
                    placeholder="Briefly state the reason for leaving campus..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Submitting Request...
                    </>
                  ) : (
                    'Submit Outpass Request'
                  )}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* LIST OF OUTPASSES */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
            <p>Loading your outpass records...</p>
          </div>
        ) : outpasses.length === 0 ? (
          <Card className="border-dashed text-center p-12 bg-white">
            <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
              <QrCode className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-1">No Outpass Requests Found</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto mb-6">
              You haven't requested any outpass yet. Click the button above to request campus leave permission.
            </p>
            <Button onClick={() => setIsDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              Apply for Outpass
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {outpasses.map((pass) => (
              <Card
                key={pass._id}
                className="bg-white shadow-sm hover:shadow-md transition border-slate-200 flex flex-col justify-between"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      {pass.category}
                    </span>
                    {getStatusBadge(pass.status)}
                  </div>
                  <CardTitle className="text-base font-semibold text-slate-900 line-clamp-1">
                    {pass.destination}
                  </CardTitle>
                  <CardDescription className="text-xs line-clamp-2">
                    {pass.reason}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3 text-xs text-slate-600">
                  <div className="space-y-1.5 p-3 rounded-lg bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      <span>
                        <strong className="text-slate-700">Depart:</strong>{' '}
                        {new Date(pass.departureDate).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-amber-600" />
                      <span>
                        <strong className="text-slate-700">Return:</strong>{' '}
                        {new Date(pass.expectedReturnDate).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-rose-500" />
                      <span>
                        <strong className="text-slate-700">Room:</strong>{' '}
                        {pass.hostel} - Room {pass.roomNumber}
                      </span>
                    </div>
                  </div>

                  {pass.adminRemarks && (
                    <div className="p-2 rounded bg-amber-50 text-amber-900 border border-amber-200">
                      <span className="font-semibold">Remarks:</span> {pass.adminRemarks}
                    </div>
                  )}

                  {/* VIEW QR PASS BUTTON FOR APPROVED PASSES */}
                  {pass.status === 'approved' && pass.passCode && (
                    <Button
                      onClick={() => setSelectedPass(pass)}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium flex items-center justify-center gap-2 mt-2 shadow-sm"
                    >
                      <QrCode className="w-4 h-4" />
                      View Digital Gate Pass ({pass.passCode})
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* DIGITAL QR GATE PASS MODAL */}
        {selectedPass && (
          <Dialog open={!!selectedPass} onOpenChange={() => setSelectedPass(null)}>
            <DialogContent className="max-w-md text-center p-6 bg-white border-2 border-emerald-500">
              <div className="flex items-center justify-center gap-2 text-emerald-700 font-bold text-lg mb-1">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
                VERIFIED DIGITAL GATE PASS
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Symbiosis Hostel Administration • Security Clearance
              </p>

              {/* QR Image */}
              {selectedPass.qrCodeDataUri && (
                <div className="p-4 bg-white border-2 border-slate-900 rounded-xl inline-block shadow-inner mx-auto mb-3">
                  <img
                    src={selectedPass.qrCodeDataUri}
                    alt="Digital Gate Pass QR"
                    className="w-48 h-48 mx-auto"
                  />
                </div>
              )}

              <div className="text-center font-mono font-bold text-lg tracking-widest text-slate-900 bg-slate-100 py-1.5 px-4 rounded-lg border inline-block mx-auto mb-4">
                {selectedPass.passCode}
              </div>

              {/* Details Table */}
              <div className="text-left text-xs space-y-2 p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex justify-between">
                  <span className="text-slate-500">Student:</span>
                  <span className="font-semibold text-slate-800">
                    {user?.firstName} {user?.lastName} ({user?.prn || 'SIT'})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Location:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedPass.hostel} • Room {selectedPass.roomNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Destination:</span>
                  <span className="font-semibold text-slate-800">{selectedPass.destination}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Valid Depart:</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(selectedPass.departureDate).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Valid Return:</span>
                  <span className="font-semibold text-slate-800">
                    {new Date(selectedPass.expectedReturnDate).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-1.5 mt-1.5">
                  <span className="text-slate-500">Emergency Phone:</span>
                  <span className="font-semibold text-slate-800">{selectedPass.emergencyContact}</span>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => window.print()}
                >
                  <Printer className="w-3.5 h-3.5 mr-1" />
                  Print Pass
                </Button>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                  onClick={() => setSelectedPass(null)}
                >
                  Close Pass
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </main>
    </div>
  );
};

export default Outpass;
