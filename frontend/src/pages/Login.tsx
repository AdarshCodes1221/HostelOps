import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Eye, EyeOff, Home, Check, X, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE_URL, API_ENDPOINTS } from '@/lib/api-config';
import hostelBg from '@/assets/our-hostels-bg1.jpeg';

const Login = () => {
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(
    location.pathname === '/register' || location.pathname === '/signup'
      ? 'signup'
      : (location.pathname.includes('security') ? 'security' : (location.pathname.includes('admin') ? 'admin' : 'login'))
  );
  const { toast } = useToast();
  const navigate = useNavigate();
  const { login, isAuthenticated, isAdmin, isWarden, isSecurity, isSuperAdmin } = useAuth();

  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    setLoginError(null);
    if (location.pathname === '/register' || location.pathname === '/signup') {
      setActiveTab('signup');
    } else if (location.pathname.includes('security')) {
      setActiveTab('security');
    } else if (location.pathname.includes('admin')) {
      setActiveTab('admin');
    }
  }, [location.pathname]);

  // Email and password validation state
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState({
    hasMinLength: false,
    hasUpperCase: false,
    hasLowerCase: false,
    hasNumber: false,
    hasSpecialChar: false,
  });

  // Redirect if already logged in — send each role to the correct dashboard
  useEffect(() => {
    if (isAuthenticated) {
      if (isSuperAdmin) {
        navigate('/super-admin/dashboard');
      } else if (isAdmin) {
        navigate('/admin/dashboard');
      } else if (isWarden) {
        navigate('/warden/dashboard');
      } else if (isSecurity) {
        navigate('/security/dashboard');
      } else {
        navigate('/dashboard');
      }
    }
  }, [isAuthenticated, isAdmin, isWarden, isSecurity, isSuperAdmin, navigate]);

  // Strict regex for SIT Pune college emails:
  // - Local part: starts/ends with alphanumeric, allows dots, hyphens, underscores, %, +, -
  // - No consecutive dots, no leading/trailing dots/hyphens
  // - Domain: exactly sitpune.edu.in
  const SIT_PUNE_EMAIL_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]*[a-zA-Z0-9])?@sitpune\.edu\.in$/;

  // Email validation function
  const validateEmail = (email: string) => {
    if (!email) {
      setEmailError('');
      return false;
    }

    // Reject multiple @ symbols (injection / spoofing attempt)
    if ((email.match(/@/g) || []).length !== 1) {
      setEmailError('Invalid email format');
      return false;
    }

    // Must end with @sitpune.edu.in (college domain only)
    if (!email.endsWith('@sitpune.edu.in')) {
      setEmailError('Only official SIT Pune college email IDs are allowed (must end with @sitpune.edu.in)');
      return false;
    }

    // Strict format validation enforcing the exact college domain
    if (!SIT_PUNE_EMAIL_REGEX.test(email)) {
      setEmailError('Invalid email format');
      return false;
    }

    setEmailError('');
    return true;
  };

  // Password strength validation function
  const validatePassword = (password: string) => {
    setPasswordStrength({
      hasMinLength: password.length >= 8,
      hasUpperCase: /[A-Z]/.test(password),
      hasLowerCase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      hasSpecialChar: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    });
  };

  const isPasswordStrong = () => {
    return Object.values(passwordStrength).every(v => v === true);
  };

  const handleSignupEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value;
    setSignupEmail(email);
    validateEmail(email);
  };

  const handleSignupPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const password = e.target.value;
    setSignupPassword(password);
    validatePassword(password);
  };

  // Check if email is valid (without calling validateEmail which updates state)
  const isEmailValid = () => {
    if (!signupEmail) return false;
    if ((signupEmail.match(/@/g) || []).length !== 1) return false;
    if (!signupEmail.endsWith('@sitpune.edu.in')) return false;
    return SIT_PUNE_EMAIL_REGEX.test(signupEmail);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const form = e.target as HTMLFormElement;
      const emailInput = (form.elements.namedItem('login-prn') || form.querySelector('input[type="email"]') || form.querySelector('input')) as HTMLInputElement;
      const passwordInput = (form.elements.namedItem('login-password') || form.querySelector('input[type="password"]')) as HTMLInputElement;
      const email = emailInput ? emailInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';

      // Determine correct endpoint: if on /admin/* or non-sitpune email, use dedicated admin login endpoint
      const isAdminRoute = location.pathname.startsWith('/admin');
      const isStaffEmail = email && !email.toLowerCase().endsWith('@sitpune.edu.in');
      const loginEndpoint = (isAdminRoute || isStaffEmail) 
        ? API_ENDPOINTS.ADMIN_LOGIN 
        : API_ENDPOINTS.LOGIN;

      const response = await fetch(`${API_BASE_URL}${loginEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Save to auth context (which also saves to localStorage)
        login(
          {
            _id: data.data._id,
            firstName: data.data.firstName,
            lastName: data.data.lastName,
            email: data.data.email,
            prn: data.data.prn || undefined,
            hostel: data.data.hostel || undefined,
            roomNumber: data.data.roomNumber || undefined,
            phone: data.data.phone || undefined,
            floor: data.data.floor || undefined,
            roomLocked: data.data.roomLocked || false,
            roomChangeRequested: data.data.roomChangeRequested || false,
            requestedRoom: data.data.requestedRoom || undefined,
            role: data.data.role,
          },
          data.data.token
        );

        toast({
          title: "Login Successful",
          description: "Welcome back to Symbiosis Hostel Management System!",
        });

        setLoginError(null);
        // Clear password field in form
        form.reset();

        // Navigate based on role — every role goes to its own dashboard
        if (data.data.role === 'super_admin') {
          navigate('/super-admin/dashboard');
        } else if (data.data.role === 'admin') {
          navigate('/admin/dashboard');
        } else if (data.data.role === 'warden') {
          navigate('/warden/dashboard');
        } else if (data.data.role === 'security') {
          navigate('/security/dashboard');
        } else {
          navigate('/dashboard');
        }
      } else {
        const pwdInput = (form.elements.namedItem('login-password') || form.querySelector('input[type="password"]')) as HTMLInputElement;
        if (pwdInput) pwdInput.value = '';
        const errMsg = data.message || "Invalid credentials. Please try again.";
        setLoginError(errMsg);
        toast({
          title: "Login Failed",
          description: errMsg,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not connect to server. Please try again later.",
        variant: "destructive",
      });
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const form = e.target as HTMLFormElement;
      const email = (form.elements.namedItem('admin-email') as HTMLInputElement).value;
      const password = (form.elements.namedItem('admin-password') as HTMLInputElement).value;

      // Strict client-side barrier against student emails
      if (email.trim().toLowerCase().endsWith('@sitpune.edu.in')) {
        toast({
          title: "Student Account Detected",
          description: "Students cannot authenticate via the Admin Portal. Please use the Student Login tab.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.ADMIN_LOGIN}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Check if user is a staff/management role (not student)
        const staffRoles = ['admin', 'warden', 'security', 'super_admin'];
        if (!staffRoles.includes(data.data.role)) {
          toast({
            title: "Access Denied",
            description: "This portal is for admin, warden, security, and super admin accounts only.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        // Save to auth context
        login(
          {
            _id: data.data._id,
            firstName: data.data.firstName,
            lastName: data.data.lastName,
            email: data.data.email,
            role: data.data.role,
            designation: data.data.designation || undefined,
            hostel: data.data.hostel || undefined,
            phone: data.data.phone || undefined,
          },
          data.data.token
        );

        toast({
          title: "Login Successful",
          description: "Welcome to the Symbiosis Hostel Management Portal!",
        });

        setLoginError(null);
        // Clear form inputs
        form.reset();

        // Route each staff role to their dedicated dashboard
        if (data.data.role === 'super_admin') {
          navigate('/super-admin/dashboard');
        } else if (data.data.role === 'warden') {
          navigate('/warden/dashboard');
        } else if (data.data.role === 'security') {
          navigate('/security/dashboard');
        } else {
          navigate('/admin/dashboard');
        }
      } else {
        const adminPwd = form.elements.namedItem('admin-password') as HTMLInputElement;
        if (adminPwd) adminPwd.value = '';
        const errMsg = data.message || "Invalid credentials. Please try again.";
        setLoginError(errMsg);
        toast({
          title: "Login Failed",
          description: errMsg,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not connect to server. Please try again later.",
        variant: "destructive",
      });
      console.error('Admin login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const form = e.target as HTMLFormElement;
      const firstName = (form.elements.namedItem('signup-firstname') as HTMLInputElement).value;
      const lastName = (form.elements.namedItem('signup-lastname') as HTMLInputElement).value;
      const prn = (form.elements.namedItem('signup-prn') as HTMLInputElement).value;
      const email = (form.elements.namedItem('signup-email') as HTMLInputElement).value;
      const phone = (form.elements.namedItem('signup-contact') as HTMLInputElement).value;
      const password = (form.elements.namedItem('signup-password') as HTMLInputElement).value;

      // Frontend validation
      if (!validateEmail(email)) {
        toast({
          title: "Validation Error",
          description: "Only official college email IDs (@sitpune.edu.in) are allowed",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const cleanPhone = phone.trim().replace(/[\s\-\(\)]/g, '');
      if (!/^[0-9]{10}$/.test(cleanPhone)) {
        toast({
          title: "Validation Error",
          description: "Please enter a valid 10-digit mobile phone number",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      if (!isPasswordStrong()) {
        toast({
          title: "Weak Password",
          description: "Password must contain at least 8 characters, 1 uppercase, 1 lowercase, 1 number, and 1 special character",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.REGISTER}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          firstName, 
          lastName, 
          prn, 
          email, 
          phone: cleanPhone,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Registration Submitted",
          description: "A 6-digit verification OTP has been sent to your official college email. Please verify to activate your account.",
        });

        // Reset sensitive input states
        setSignupPassword('');
        form.reset();

        // Redirect to OTP verification screen with email prefilled
        navigate(`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}`);
      } else {
        toast({
          title: "Registration Failed",
          description: data.message || "Could not create account. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Could not connect to server. Please try again later.",
        variant: "destructive",
      });
      console.error('Signup error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden">
      {/* Enhanced Background Image Layer - Crystal Clear */}
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
      
      {/* Subtle Blue to Warm Orange Gradient Overlay */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.18) 0%, rgba(251, 146, 60, 0.18) 100%)'
        }}
      />
      
      {/* Subtle vignette effect for depth */}
      <div 
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at center, transparent 0%, rgba(0, 0, 0, 0.15) 100%)'
        }}
      />

      {/* Content */}
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-6">
          <Link to="/" className="inline-flex items-center space-x-2 text-white hover:text-white hover:scale-105 transition-all duration-300 drop-shadow-lg hover:drop-shadow-2xl">
            <Home className="w-5 h-5" />
            <span className="font-medium">Back to Home</span>
          </Link>
        </div>

        <Card className="shadow-2xl backdrop-blur-sm bg-white/95 border-white/60 hover:shadow-[0_25px_60px_-12px_rgba(0,0,0,0.35)] hover:scale-[1.02] transition-all duration-500 ease-out">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 gradient-primary rounded-full flex items-center justify-center mb-4 shadow-lg hover:shadow-xl hover:scale-110 transition-all duration-300 cursor-pointer">
              <span className="text-primary-foreground font-bold text-2xl">S</span>
            </div>
            <CardTitle className="text-2xl bg-gradient-to-r from-blue-600 to-orange-500 bg-clip-text text-transparent">Welcome to Symbiosis HMS</CardTitle>
            <CardDescription className="text-gray-600">
              Access your hostel management account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="login">Student</TabsTrigger>
                <TabsTrigger value="admin">Staff/Admin</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="space-y-4">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-prn">Email or PRN</Label>
                    <Input
                      id="login-prn"
                      name="login-prn"
                      placeholder="your.email@sitpune.edu.in"
                      required
                      className="transition-smooth"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="login-password"
                        name="login-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
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
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  {loginError && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center justify-between">
                      <span>{loginError}</span>
                      <Link to="/forgot-password" className="font-semibold underline ml-2 whitespace-nowrap text-primary">
                        Forgot Password?
                      </Link>
                    </div>
                  )}
                  <div className="text-right">
                    <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                      Forgot Password?
                    </Link>
                  </div>
                  <Button
                    type="submit"
                    className="w-full gradient-primary text-primary-foreground hover:opacity-90 transition-smooth"
                    disabled={isLoading}
                  >
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setLoginError(null);
                        setActiveTab('security');
                      }}
                      className="text-xs text-muted-foreground hover:text-primary transition"
                    >
                      🛡️ Security Staff? Sign in to Gate Portal →
                    </button>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="admin" className="space-y-4">
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  {loginError && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center justify-between">
                      <span>{loginError}</span>
                      <Link to="/admin/forgot-password" className="font-semibold underline ml-2 whitespace-nowrap text-warning">
                        Forgot Password?
                      </Link>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">Staff / Admin Email</Label>
                    <Input
                      id="admin-email"
                      name="admin-email"
                      type="email"
                      placeholder="admin@sitpune.edu.in"
                      required
                      className="transition-smooth"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="admin-password"
                        name="admin-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter password"
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
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="text-right">
                    <Link to="/admin/forgot-password" className="text-sm text-warning hover:underline">
                      Forgot Password?
                    </Link>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-warning text-warning-foreground hover:opacity-90 transition-smooth"
                    disabled={isLoading}
                  >
                    {isLoading ? "Signing in..." : "Staff / Admin Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="security" className="space-y-4">
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-700 flex items-center gap-2">
                  <Shield className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>Authorized Security Personnel Only — Gate & Outpass Verification Portal</span>
                </div>
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  {loginError && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-center justify-between">
                      <span>{loginError}</span>
                      <Link to="/admin/forgot-password" className="font-semibold underline ml-2 whitespace-nowrap text-blue-600">
                        Forgot Password?
                      </Link>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="security-email">Security Staff Email</Label>
                    <Input
                      id="security-email"
                      name="admin-email"
                      type="email"
                      placeholder="security.gate@symbiosis.ac.in"
                      required
                      className="transition-smooth"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="security-password">Security Password</Label>
                    <div className="relative">
                      <Input
                        id="security-password"
                        name="admin-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter security password"
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
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  <div className="text-right">
                    <Link to="/admin/forgot-password" className="text-sm text-blue-600 hover:underline">
                      Forgot Password?
                    </Link>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium transition-smooth"
                    disabled={isLoading}
                  >
                    {isLoading ? "Verifying..." : "Security Gate Sign In"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-firstname">First Name</Label>
                      <Input
                        id="signup-firstname"
                        placeholder="First name"
                        required
                        className="transition-smooth"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-lastname">Last Name</Label>
                      <Input
                        id="signup-lastname"
                        placeholder="Last name"
                        required
                        className="transition-smooth"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-prn">PRN</Label>
                    <Input
                      id="signup-prn"
                      placeholder="e.g., 23070122261"
                      required
                      className="transition-smooth"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Official College Email (@sitpune.edu.in)</Label>
                    <Input
                      id="signup-email"
                      name="signup-email"
                      type="email"
                      placeholder="your.email@sitpune.edu.in"
                      value={signupEmail}
                      onChange={handleSignupEmailChange}
                      required
                      className={`transition-smooth ${emailError ? 'border-destructive' : ''}`}
                    />
                    {emailError && (
                      <p className="text-sm text-destructive">{emailError}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-contact">Contact Number (10 Digits)</Label>
                    <Input
                      id="signup-contact"
                      type="tel"
                      placeholder="9876543210"
                      required
                      pattern="[0-9]{10}"
                      className="transition-smooth"
                    />
                  </div>

                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-xs text-muted-foreground flex items-start gap-2">
                    <span className="text-base leading-none">ℹ️</span>
                    <div>
                      <strong className="text-foreground">Hostel & Room Allocation:</strong>
                      <p className="mt-0.5">Students do not select rooms during registration. After submission, your account will be placed in <span className="font-semibold text-primary">Pending</span> status until the hostel warden/admin reviews your details and assigns your hostel, floor, and room.</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        name="signup-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Create a password"
                        value={signupPassword}
                        onChange={handleSignupPasswordChange}
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
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
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
                          At least 1 special character (!@#$%^&* etc.)
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <Button
                    type="submit"
                    className="w-full gradient-secondary text-secondary-foreground hover:opacity-90 transition-smooth"
                    disabled={isLoading || !isEmailValid() || !isPasswordStrong()}
                  >
                    {isLoading ? "Creating Account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;