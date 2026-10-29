import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Eye, EyeOff, Check, X, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE_URL, API_ENDPOINTS } from '@/lib/api-config';
import hostelBg from '@/assets/our-hostels-bg1.jpeg';

const AdminResetPassword = () => {
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
    if (confirmPassword && pwd !== confirmPassword) {
      setPasswordError('Passwords do not match');
    } else {
      setPasswordError('');
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      toast({
        title: 'Error',
        description: 'Reset token is missing or invalid.',
        variant: 'destructive',
      });
      return;
    }

    if (!isPasswordStrong()) {
      toast({
        title: 'Weak Password',
        description: 'Please satisfy all security criteria for your new password.',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}${API_ENDPOINTS.ADMIN_RESET_PASSWORD(token)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ password }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: 'Credentials Updated',
          description: 'Administrator password reset successful! Please log in with your new password.',
        });

        // Clear password state
        setPassword('');
        setConfirmPassword('');

        navigate('/admin/login');
      } else {
        toast({
          title: 'Reset Failed',
          description: data.message || 'Invalid or expired reset token.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Could not connect to authentication server.',
        variant: 'destructive',
      });
      console.error('Admin reset password error:', error);
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
          <p className="text-sm text-white/70">Create New Administrator Password</p>
        </div>

        <Card className="shadow-2xl border-white/10 bg-card/95 backdrop-blur-md">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl text-center">Set New Password</CardTitle>
            <CardDescription className="text-center">
              Please enter a strong new password for administrative access
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="admin-new-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter new password"
                    value={password}
                    onChange={handlePasswordChange}
                    required
                    className="pr-10"
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
                <Label htmlFor="admin-confirm-password">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="admin-confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={handleConfirmChange}
                    required
                    className="pr-10"
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
                {passwordError && (
                  <p className="text-xs text-destructive">{passwordError}</p>
                )}
              </div>

              {/* Password Requirements */}
              <div className="p-3 bg-muted/60 rounded-lg space-y-1.5 text-xs">
                <div className="flex items-center gap-2">
                  {passwordStrength.hasMinLength ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className={passwordStrength.hasMinLength ? 'text-green-600' : 'text-muted-foreground'}>
                    At least 8 characters
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {passwordStrength.hasUpperCase ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className={passwordStrength.hasUpperCase ? 'text-green-600' : 'text-muted-foreground'}>
                    At least 1 uppercase letter
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {passwordStrength.hasLowerCase ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className={passwordStrength.hasLowerCase ? 'text-green-600' : 'text-muted-foreground'}>
                    At least 1 lowercase letter
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {passwordStrength.hasNumber ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className={passwordStrength.hasNumber ? 'text-green-600' : 'text-muted-foreground'}>
                    At least 1 number
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {passwordStrength.hasSpecialChar ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className={passwordStrength.hasSpecialChar ? 'text-green-600' : 'text-muted-foreground'}>
                    At least 1 special character
                  </span>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-warning text-warning-foreground hover:opacity-90"
                disabled={isLoading || !isPasswordStrong() || !!passwordError || !confirmPassword}
              >
                {isLoading ? 'Updating Password...' : 'Save & Log In to Admin Portal'}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminResetPassword;
