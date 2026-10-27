import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { API_BASE_URL, API_ENDPOINTS, authenticatedFetch } from '@/lib/api-config';
import { useAuth } from '@/contexts/AuthContext';
import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Loader2,
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  User,
  Home,
  ArrowLeft,
  QrCode,
} from 'lucide-react';

interface VerificationResult {
  valid: boolean;
  message: string;
  data?: {
    passCode: string;
    status: string;
    studentName: string;
    prn: string;
    hostel: string;
    roomNumber: string;
    category?: string;
    destination?: string;
    departureDate?: string;
    expectedReturnDate?: string;
    approvedBy?: string;
    approvedAt?: string;
    emergencyContact?: string;
    usedAt?: string;
    remarks?: string;
  };
}

const VerifyOutpass: React.FC = () => {
  const [searchParams] = useSearchParams();
  const codeParam = searchParams.get('passCode') || '';
  const { isSecurity } = useAuth();

  const [passCodeInput, setPassCodeInput] = useState(codeParam);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);

  const handleGateCheckout = async () => {
    if (!result?.data?.passCode) return;
    setIsCheckingOut(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.SECURITY_CHECKOUT, {
        method: 'POST',
        body: JSON.stringify({ passCode: result.data.passCode }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCheckoutSuccess(true);
        if (result.data) {
          result.data.status = 'checked_out';
          result.data.usedAt = data.data?.checkedOutAt || new Date().toISOString();
        }
      } else {
        alert(data.message || 'Could not complete gate check-out.');
      }
    } catch {
      alert('Network error while processing gate check-out.');
    } finally {
      setIsCheckingOut(false);
    }
  };

  const verifyPass = async (codeToVerify: string) => {
    if (!codeToVerify.trim()) return;

    setIsLoading(true);
    setResult(null);

    try {
      // Security officers use the authenticated endpoint for full gate details
      // Everyone else (students, public QR scan) uses the public read-only endpoint
      let res: Response;
      if (isSecurity) {
        res = await authenticatedFetch(API_ENDPOINTS.SECURITY_VERIFY_QR, {
          method: 'POST',
          body: JSON.stringify({ passCode: codeToVerify.trim() }),
        });
      } else {
        res = await fetch(`${API_BASE_URL}/outpass/verify-public`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ passCode: codeToVerify.trim() }),
        });
      }

      const data = await res.json();
      setResult(data);
    } catch {
      setResult({
        valid: false,
        message: 'Could not connect to the campus gate verification server.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (codeParam) {
      verifyPass(codeParam);
    }
  }, [codeParam]);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between p-4 sm:p-8">
      <div className="max-w-lg w-full mx-auto space-y-6">
        {/* Header navigation */}
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Portal
          </Link>
          <span className="text-xs uppercase font-bold tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">
            Security Gate Verification
          </span>
        </div>

        <Card className="shadow-lg border-slate-200 bg-white">
          <CardHeader className="text-center pb-4">
            <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2">
              <QrCode className="w-7 h-7" />
            </div>
            <CardTitle className="text-xl font-bold text-slate-900">
              Campus Gate Clearance
            </CardTitle>
            <CardDescription className="text-xs">
              Symbiosis Hostel Security • Instant Digital Pass Verification
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Input / Manual Search */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                verifyPass(passCodeInput);
              }}
              className="flex gap-2"
            >
              <Input
                placeholder="Enter Pass Code (e.g. OP-7F3A29B0D1E4)"
                value={passCodeInput}
                onChange={(e) => setPassCodeInput(e.target.value.toUpperCase())}
                className="font-mono text-xs uppercase"
              />
              <Button type="submit" disabled={isLoading || !passCodeInput.trim()} className="bg-blue-600 hover:bg-blue-700 text-xs">
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
              </Button>
            </form>

            {/* RESULTS */}
            {isLoading && (
              <div className="py-10 text-center text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
                <p className="text-xs">Authenticating gate pass against university registry...</p>
              </div>
            )}

            {!isLoading && result && (
              <div className="space-y-4 pt-2">
                {/* VALID PASS */}
                {result.valid && result.data && (
                  <div className="p-4 rounded-xl bg-emerald-50 border-2 border-emerald-500 space-y-4 text-emerald-950">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-emerald-600 text-white">
                        <ShieldCheck className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-emerald-900 text-base leading-tight">
                          GATE PASS VALID
                        </h4>
                        <p className="text-xs text-emerald-700">Authorized for Campus Clearance</p>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs bg-white/80 p-3 rounded-lg border border-emerald-200">
                      <div className="flex justify-between border-b pb-1">
                        <span className="text-slate-500 font-medium">Pass Code:</span>
                        <span className="font-mono font-bold text-slate-900">{result.data.passCode}</span>
                      </div>
                      <div className="flex justify-between border-b pb-1">
                        <span className="text-slate-500 font-medium">Student Name:</span>
                        <span className="font-semibold text-slate-800">{result.data.studentName}</span>
                      </div>
                      <div className="flex justify-between border-b pb-1">
                        <span className="text-slate-500 font-medium">PRN:</span>
                        <span className="font-mono text-slate-800">{result.data.prn}</span>
                      </div>
                      <div className="flex justify-between border-b pb-1">
                        <span className="text-slate-500 font-medium">Hostel / Room:</span>
                        <span className="font-medium text-slate-800">
                          {result.data.hostel} • Room {result.data.roomNumber}
                        </span>
                      </div>
                      <div className="flex justify-between border-b pb-1">
                        <span className="text-slate-500 font-medium">Destination:</span>
                        <span className="font-medium text-slate-800">{result.data.destination}</span>
                      </div>
                      <div className="flex justify-between border-b pb-1">
                        <span className="text-slate-500 font-medium">Departure Window:</span>
                        <span className="font-medium text-slate-800">
                          {new Date(result.data.departureDate!).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between border-b pb-1">
                        <span className="text-slate-500 font-medium">Expected Return:</span>
                        <span className="font-medium text-slate-800">
                          {new Date(result.data.expectedReturnDate!).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between pt-0.5">
                        <span className="text-slate-500 font-medium">Approved By:</span>
                        <span className="font-semibold text-emerald-800">{result.data.approvedBy}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-emerald-800 font-medium">
                      <span>Emergency: {result.data.emergencyContact}</span>
                      <Badge className="bg-emerald-600 text-white">STATUS: {result.data.status.toUpperCase()}</Badge>
                    </div>

                    {/* GATE CHECKOUT ACTION — security officers only */}
                    {isSecurity && result.data.status === 'approved' && !checkoutSuccess && (
                      <div className="pt-2 border-t border-emerald-200">
                        <Button
                          onClick={handleGateCheckout}
                          disabled={isCheckingOut}
                          className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-2.5 rounded-lg shadow transition flex items-center justify-center gap-2"
                        >
                          {isCheckingOut ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Recording Gate Departure...
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-5 h-5" />
                              VERIFY & CHECK OUT (ALLOW EXIT)
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {/* CHECKOUT SUCCESS BANNER */}
                    {checkoutSuccess && (
                      <div className="p-3 bg-emerald-700 text-white rounded-lg text-center space-y-1">
                        <div className="flex items-center justify-center gap-1.5 font-bold text-sm">
                          <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                          CHECK-OUT SUCCESSFUL
                        </div>
                        <p className="text-xs text-emerald-100">
                          Departure confirmed. Gate pass is now CLOSED & CANNOT BE REUSED.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* INVALID / REJECTED / EXPIRED PASS */}
                {!result.valid && (
                  <div className="p-4 rounded-xl bg-rose-50 border-2 border-rose-500 space-y-3 text-rose-950">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-full bg-rose-600 text-white">
                        <ShieldX className="w-6 h-6" />
                      </div>
                      <div>
                        <h4 className="font-bold text-rose-900 text-base leading-tight">
                          ACCESS DENIED
                        </h4>
                        <p className="text-xs text-rose-700">Gate pass is invalid or expired</p>
                      </div>
                    </div>

                    <p className="text-xs font-semibold p-2.5 bg-white/80 rounded border border-rose-200 text-rose-800">
                      {result.message}
                    </p>

                    {result.data?.remarks && (
                      <p className="text-xs text-slate-600">
                        <strong>Remarks:</strong> {result.data.remarks}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <footer className="text-center text-xs text-slate-400 mt-6">
        Symbiosis Hostel Management System • High-Security Gate Verification Protocol
      </footer>
    </div>
  );
};

export default VerifyOutpass;
