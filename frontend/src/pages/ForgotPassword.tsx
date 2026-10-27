import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Home } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL, API_ENDPOINTS } from '@/lib/api-config';
import hostelBg from '@/assets/our-hostels-bg1.jpeg';

// Validation regex
const GENERAL_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const { toast } = useToast();
  const navigate = useNavigate();

  const validateEmail = (email: string) => {
    if (!email) {
      setEmailError('Please enter your email address');
      return false;
    }

    if ((email.match(/@/g) || []).length !== 1) {
      setEmailError('Invalid email format');
      return false;
    }

    if (!GENERAL_EMAIL_REGEX.test(email)) {
      setEmailError('Please enter a valid email address');
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
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.FORGOT_PASSWORD}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIsSubmitted(true);
        // In development, the backend returns the resetToken directly
        if (data.resetToken) {
          setResetToken(data.resetToken);
        }
        toast({
          title: 'Reset Link Sent',
          description: 'If an account exists, a reset link has been sent to your email.',
        });
      } else {
        toast({
          title: 'Error',
          description: data.message || 'Could not send reset link. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not connect to server. Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* Background Image Layer */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: `url(${hostelBg})`,
          filter: 'brightness(1.1) contrast(1.2) saturate(1.25)',
          imageRendering: 'crisp-edges',
          WebkitBackfaceVisibility: 'hidden',
          backfaceVisibility: 'hidden',
        }}
      />

      {/* Gradient Overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.18) 0%, rgba(251, 146, 60, 0.18) 100%)'
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at center, transparent 0%, rgba(0, 0, 0, 0.15) 100%)'
        }}
      />

      {/* Content */}
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center space-x-2 text-white hover:white hover:scale-105 transition-all duration-300 drop-shadow-lg">
            <Home className="w-5 h-5" />
            <span className="font-medium">Back to Home</span>
          </Link>
        </div>

        <Card className="shadow-2xl backdrop-blur-sm bg-white/95 border-white/60 hover:shadow-[0_25px_60px_-12px_rgba(0,0,0,0.35)] hover:scale-[1.02] transition-all duration-500 ease-out">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 gradient-primary rounded-full flex items-center justify-center mb-4 shadow-lg">
              <Mail className="w-8 h-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl bg-gradient-to-r from-blue-600 to-orange-500 bg-clip-text text-transparent">
              Forgot Password
            </CardTitle>
            <CardDescription className="text-gray-600">
              {isSubmitted
                ? 'Check your email for the reset link'
                : 'Enter your registered email address to receive a password reset link'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!isSubmitted ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">Email Address</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="your.email@sitpune.edu.in"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      validateEmail(e.target.value);
                    }}
                    required
                    className={`transition-smooth ${emailError ? 'border-destructive' : ''}`}
                  />
                  {emailError && (
                    <p className="text-sm text-destructive">{emailError}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full gradient-primary text-primary-foreground hover:opacity-90 transition-smooth"
                  disabled={isLoading || !GENERAL_EMAIL_REGEX.test(email)}
                >
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </Button>
              </form>
            ) : (
              <div className="space-y-4 text-center">
                <p className="text-sm text-green-600">
                  If an account with that email exists, a reset link has been sent.
                </p>

                {resetToken && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">
                      (Development mode — here is your reset token)
                    </p>
                    <code
                      className="block text-xs bg-muted/50 p-2 rounded break-all cursor-pointer"
                      onClick={() => navigator.clipboard.writeText(resetToken)}
                      title="Click to copy"
                    >
                      {resetToken}
                    </code>
                    <Button
                      variant="link"
                      className="text-sm"
                      onClick={() => navigate(`/reset-password/${resetToken}`)}
                    >
                      Go to Reset Page
                    </Button>
                  </div>
                )}

                <Link
                  to="/login"
                  className="inline-block text-sm text-primary hover:underline"
                >
                  Back to Login
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;
