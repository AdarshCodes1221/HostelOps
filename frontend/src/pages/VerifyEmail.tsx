import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, Mail, Loader2, ArrowLeft, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL, API_ENDPOINTS } from '@/lib/api-config';
import hostelBg from '@/assets/our-hostels-bg1.jpeg';

const GENERAL_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VerifyEmail: React.FC = () => {
  const { token: paramToken } = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const token = paramToken || searchParams.get('token') || '';
  const initialOtp = searchParams.get('otp') || '';
  const initialEmail = searchParams.get('email') || '';

  const [otp, setOtp] = useState(initialOtp);
  const [manualToken, setManualToken] = useState(token);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [resendEmail, setResendEmail] = useState(initialEmail);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const { toast } = useToast();

  const handleVerify = useCallback(async (codeOrToken: string, targetEmail?: string) => {
    const cleanCode = (codeOrToken || '').trim();
    if (!cleanCode) {
      setStatus('error');
      setMessage('Please enter your 6-digit verification OTP or token.');
      return;
    }

    setStatus('loading');
    try {
      const payload: { token?: string; otp?: string; email?: string } = {};
      if (/^\d{6}$/.test(cleanCode)) {
        payload.otp = cleanCode;
        if (targetEmail || resendEmail) {
          payload.email = (targetEmail || resendEmail).trim().toLowerCase();
        }
      } else {
        payload.token = cleanCode;
      }

      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.VERIFY_EMAIL}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus('success');
        setMessage(data.message || 'Your email has been verified successfully!');
        toast({
          title: 'Email Verified',
          description: 'Your account is now active and queued for administrator room allocation.',
        });
      } else {
        setStatus('error');
        setMessage(data.message || 'Verification code is invalid, expired, or has already been used.');
      }
    } catch {
      setStatus('error');
      setMessage('Network error. Unable to connect to verification service.');
    }
  }, [resendEmail, toast]);

  useEffect(() => {
    if (token) {
      handleVerify(token);
    }
  }, [token, handleVerify]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (cooldown > 0) {
      timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resendEmail || !GENERAL_EMAIL_REGEX.test(resendEmail.trim())) {
      toast({
        title: 'Invalid Email',
        description: 'Please enter a valid university email address.',
        variant: 'destructive',
      });
      return;
    }

    setIsResending(true);
    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.RESEND_VERIFICATION}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: resendEmail.trim().toLowerCase() }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setResendSuccess(true);
        setCooldown(60);
        toast({
          title: 'Verification Link Sent',
          description: data.message || 'If an unverified account exists, a new link has been sent.',
        });
      } else {
        toast({
          title: 'Resend Failed',
          description: data.message || 'Unable to resend verification link at this time.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Connection Error',
        description: 'Failed to communicate with the verification server.',
        variant: 'destructive',
      });
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* Background Image Layer */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${hostelBg})`,
          filter: 'brightness(1.05) contrast(1.15)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, rgba(30, 58, 138, 0.45) 0%, rgba(234, 88, 12, 0.35) 100%)',
        }}
      />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-6">
          <Link
            to="/login"
            className="inline-flex items-center space-x-2 text-white hover:text-white/80 transition drop-shadow-md"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-medium text-sm">Back to Login</span>
          </Link>
        </div>

        <Card className="shadow-2xl backdrop-blur-md bg-white/95 border-white/40">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-3 shadow-md bg-blue-50">
              {status === 'loading' && <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />}
              {status === 'success' && <CheckCircle2 className="w-8 h-8 text-emerald-600" />}
              {status === 'error' && <XCircle className="w-8 h-8 text-rose-600" />}
              {status === 'idle' && <Mail className="w-8 h-8 text-blue-600" />}
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-700 to-orange-600 bg-clip-text text-transparent">
              {status === 'loading' && 'Verifying Email...'}
              {status === 'success' && 'Email Verified!'}
              {status === 'error' && 'Verification Issue'}
              {status === 'idle' && 'Verify Your Email'}
            </CardTitle>
            <CardDescription className="text-gray-600">
              {status === 'loading' && 'Please wait while we confirm your security token.'}
              {status === 'success' && 'Your university credentials have been authenticated.'}
              {status === 'error' && (message || 'The verification link is invalid or expired.')}
              {status === 'idle' && 'Paste your verification token or link below.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* SUCCESS STATE */}
            {status === 'success' && (
              <div className="space-y-4 text-center">
                <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">
                  <p className="font-semibold mb-1">Account Queued for Approval</p>
                  <p className="text-xs text-emerald-700">
                    Your email is now verified! The warden / hostel office will review your registration and assign your room. You can log in once approved.
                  </p>
                </div>
                <Button asChild className="w-full bg-gradient-to-r from-blue-600 to-orange-500 hover:opacity-90">
                  <Link to="/login">Go to Student Login</Link>
                </Button>
              </div>
            )}

            {/* ERROR OR IDLE STATE */}
            {(status === 'error' || status === 'idle') && (
              <div className="space-y-5">
                {/* 6-Digit OTP Verification Form */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleVerify(otp, resendEmail);
                  }}
                  className="space-y-3"
                >
                  <div className="space-y-1">
                    <Label htmlFor="otp-input" className="text-xs font-semibold text-gray-700">
                      Enter 6-Digit Verification OTP
                    </Label>
                    <Input
                      id="otp-input"
                      type="text"
                      maxLength={6}
                      placeholder="e.g. 482910"
                      value={otp}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setOtp(val);
                        if (val.length === 6) {
                          handleVerify(val, resendEmail);
                        }
                      }}
                      className="font-mono text-center text-xl font-bold tracking-widest uppercase py-3 h-12"
                      autoFocus
                    />
                    <p className="text-[11px] text-gray-500 text-center">
                      We sent a 6-digit code to your email address via Brevo.
                    </p>
                  </div>
                  <Button
                    type="submit"
                    disabled={status === 'loading' || otp.trim().length !== 6}
                    className="w-full bg-gradient-to-r from-blue-600 to-orange-500 hover:opacity-90 text-white font-semibold py-2.5"
                  >
                    {status === 'loading' ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Verifying OTP...
                      </>
                    ) : (
                      'Verify & Activate Account'
                    )}
                  </Button>
                </form>

                {/* Optional Token Fallback */}
                <div className="border-t pt-3">
                  <details className="text-xs text-gray-500">
                    <summary className="cursor-pointer font-medium hover:text-gray-700">
                      Or verify using 64-character token
                    </summary>
                    <div className="space-y-2 mt-2">
                      <Input
                        id="token-input"
                        type="text"
                        placeholder="Paste verification token"
                        value={manualToken}
                        onChange={(e) => setManualToken(e.target.value)}
                        className="font-mono text-xs"
                      />
                      <Button
                        type="button"
                        onClick={() => handleVerify(manualToken)}
                        disabled={!manualToken.trim()}
                        variant="secondary"
                        className="w-full text-xs"
                      >
                        Verify Token
                      </Button>
                    </div>
                  </details>
                </div>

                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-400">Need a new link?</span>
                  </div>
                </div>

                {/* Resend Verification Form */}
                <form onSubmit={handleResend} className="space-y-3">
                  <div className="space-y-1">
                    <Label htmlFor="resend-email" className="text-xs font-semibold text-gray-700">
                      University Email Address
                    </Label>
                    <Input
                      id="resend-email"
                      type="email"
                      placeholder="student@sitpune.edu.in"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={isResending || cooldown > 0}
                    className="w-full text-xs font-medium border-gray-300 hover:bg-gray-50 flex items-center justify-center gap-1.5"
                  >
                    {isResending ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5" />
                    )}
                    {cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend Verification Email'}
                  </Button>
                  {resendSuccess && (
                    <p className="text-xs text-center text-emerald-600">
                      If an unverified account is registered, a new verification link was sent.
                    </p>
                  )}
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default VerifyEmail;
