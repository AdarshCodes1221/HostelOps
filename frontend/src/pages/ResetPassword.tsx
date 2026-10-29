import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Eye, EyeOff, Home, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE_URL, API_ENDPOINTS } from '@/lib/api-config';
import hostelBg from '@/assets/our-hostels-bg1.jpeg';

const ResetPassword = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({
    hasMinLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false,
  });
  const { toast } = useToast();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { token } = useParams<{ token: string }>();

  // Password strength validation
  const validatePassword = (pwd: string) => {
    setPasswordStrength({
      hasMinLength: pwd.length >= 8,
      hasUpperCase: /[A-Z]/.test(pwd),
      hasLowerCase: /[a-z]/.test(pwd),
      hasNumber: /[0-9]/.test(pwd),
      hasSpecialChar: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd),
    });
  };

  const isPasswordStrong = () => {
    return Object.values(passwordStrength).every((v) => v === true);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pwd = e.target.value;
    setPassword(pwd);
    validatePassword(pwd);
    setPasswordError('');
  };

  const handleConfirmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pwd = e.target.value;
    setConfirmPassword(pwd);

    if (pwd !== password) {
      setPasswordError('Passwords do not match');
    } else {
      setPasswordError('');
    }
  };

  useEffect(() => {
    if (!token) {
      toast({
        title: 'Missing Token',
        description: 'Please use the reset link from your email.',
        variant: 'destructive',
      });
      navigate('/forgot-password');
    }
  }, [token, navigate, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) return;

    if (!password || !confirmPassword) {
      setPasswordError('Both password fields are required');
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    if (!isPasswordStrong()) {
      toast({
        title: 'Weak Password',
        description: 'Password must contain at least 8 characters, 1 uppercase, 1 lowercase, 1 number, and 1 special character',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.RESET_PASSWORD(token)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: 'Password Reset Successful',
          description: 'Your password has been reset successfully. Please log in with your new password.',
        });

        // Clear sensitive password state
        setPassword('');
        setConfirmPassword('');

        navigate('/login');
      } else {
        toast({
          title: 'Reset Failed',
          description: data.message || 'Failed to reset password. The token may have expired or is invalid.',
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
              <Lock className="w-8 h-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl bg-gradient-to-r from-blue-600 to-orange-500 bg-clip-text text-transparent">
              Reset Password
            </CardTitle>
            <CardDescription className="text-gray-600">
              Enter your new password below
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="reset-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={password}
                    onChange={handlePasswordChange}
                    required
                    className="pr-10 transition-smooth"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reset-confirm">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="reset-confirm"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={handleConfirmChange}
                    required
                    className="pr-10 transition-smooth"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirm(!showConfirm)}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {passwordError && (
                <p className="text-sm text-destructive">{passwordError}</p>
              )}

              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  {passwordStrength.hasMinLength ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={passwordStrength.hasMinLength ? 'text-green-600' : 'text-muted-foreground'}>
                    At least 8 characters
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {passwordStrength.hasUpperCase ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={passwordStrength.hasUpperCase ? 'text-green-600' : 'text-muted-foreground'}>
                    At least 1 uppercase letter
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {passwordStrength.hasLowerCase ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={passwordStrength.hasLowerCase ? 'text-green-600' : 'text-muted-foreground'}>
                    At least 1 lowercase letter
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {passwordStrength.hasNumber ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={passwordStrength.hasNumber ? 'text-green-600' : 'text-muted-foreground'}>
                    At least 1 number
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {passwordStrength.hasSpecialChar ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <X className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={passwordStrength.hasSpecialChar ? 'text-green-600' : 'text-muted-foreground'}>
                    At least 1 special character
                  </span>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full gradient-primary text-primary-foreground hover:opacity-90 transition-smooth"
                disabled={isLoading || !isPasswordStrong() || password !== confirmPassword}
              >
                {isLoading ? 'Resetting...' : 'Reset Password'}
              </Button>

              <div className="text-center text-sm">
                <Link to="/login" className="text-primary hover:underline">
                  Back to Login
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ResetPassword;
