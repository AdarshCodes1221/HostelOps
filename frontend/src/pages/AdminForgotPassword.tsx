import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Shield, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL, API_ENDPOINTS } from '@/lib/api-config';
import hostelBg from '@/assets/our-hostels-bg1.jpeg';

const GENERAL_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const AdminForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const { toast } = useToast();
  const navigate = useNavigate();

  const validateEmail = (val: string) => {
    if (!val) {
      setEmailError('Please enter your administrator email address');
      return false;
    }

    if ((val.match(/@/g) || []).length !== 1 || !GENERAL_EMAIL_REGEX.test(val)) {
      setEmailError('Please enter a valid email address');
      return false;
    }

    if (val.trim().toLowerCase().endsWith('@sitpune.edu.in')) {
      setEmailError('Students must use the Student Password Reset portal, not Admin recovery');
      return false;
    }

    setEmailError('');
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateEmail(email)) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.ADMIN_FORGOT_PASSWORD}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIsSubmitted(true);
        if (data.resetToken) {
          setResetToken(data.resetToken);
        }
        toast({
          title: 'Request Sent',
          description: data.message || 'If an admin account exists, a reset link has been dispatched.',
        });
      } else {
        toast({
          title: 'Request Failed',
          description: data.message || 'Could not process password reset request.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not connect to the authentication server.',
        variant: 'destructive',
      });
      console.error('Admin forgot password error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat filter blur-sm scale-105"
        style={{ backgroundImage: `url(${hostelBg})` }}
      />
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      <div className="relative z-10 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-warning/20 border border-warning/40 text-warning mb-3">
            <Shield className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Administration Portal</h1>
          <p className="text-sm text-white/70">Administrator & Warden Password Recovery</p>
        </div>

        <Card className="shadow-2xl border-white/10 bg-card/95 backdrop-blur-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-center">Reset Admin Credentials</CardTitle>
            <CardDescription className="text-center">
              {isSubmitted 
                ? "Check your registered administrator inbox"
                : "Enter your official administrative email address"}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {isSubmitted ? (
              <div className="space-y-4 text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
                  <Mail className="w-6 h-6" />
                </div>
                <p className="text-sm text-muted-foreground">
                  If an account exists for <strong className="text-foreground">{email}</strong>, you will receive a secure password reset link valid for 20 minutes.
                </p>

                {resetToken && (
                  <div className="p-3 bg-muted rounded-lg text-left text-xs border border-border">
                    <p className="font-semibold text-warning mb-1">Development Mode Reset Shortcut:</p>
                    <Link
                      to={`/admin/reset-password/${resetToken}`}
                      className="text-primary underline break-all hover:opacity-80"
                    >
                      Click here to reset password directly
                    </Link>
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full mt-4"
                  onClick={() => navigate('/login')}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sign In
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-recovery-email">Admin / Warden Email</Label>
                  <Input
                    id="admin-recovery-email"
                    type="email"
                    placeholder="e.g., admin@siu.edu.in"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (emailError) validateEmail(e.target.value);
                    }}
                    required
                    className={emailError ? 'border-destructive' : ''}
                  />
                  {emailError && (
                    <p className="text-xs text-destructive">{emailError}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-warning text-warning-foreground hover:opacity-90"
                  disabled={isLoading}
                >
                  {isLoading ? 'Sending Reset Link...' : 'Send Recovery Link'}
                </Button>

                <div className="text-center pt-2">
                  <Link
                    to="/login"
                    className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" /> Return to Login
                  </Link>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminForgotPassword;
