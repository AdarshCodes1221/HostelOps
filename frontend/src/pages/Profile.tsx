import React, { useEffect, useRef, useState } from 'react';
import { Navigation } from '@/components/ui/navigation';
import Footer from '@/components/ui/footer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  AlertCircle,
  Building2,
  Camera,
  CheckCircle2,
  Edit3,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  Shield,
  User,
  X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { API_ENDPOINTS, authenticatedFetch, resolveAssetUrl } from '@/lib/api-config';

type ProfileState = {
  firstName: string;
  lastName: string;
  email: string;
  recoveryEmail?: string;
  isRecoveryEmailVerified?: boolean;
  phone: string;
  prn: string;
  profileImage: string;
  designation: string;
  emergencyContact: string;
  hostel: string;
  floor: string;
  roomNumber: string;
  roomLocked: boolean;
  roomChangeRequested: boolean;
  requestedRoom: string;
  role: 'student' | 'admin' | 'warden';
};

const emptyProfile: ProfileState = {
  firstName: '',
  lastName: '',
  email: '',
  recoveryEmail: '',
  isRecoveryEmailVerified: false,
  phone: '',
  prn: '',
  profileImage: '',
  designation: '',
  emergencyContact: '',
  hostel: '',
  floor: '',
  roomNumber: '',
  roomLocked: false,
  roomChangeRequested: false,
  requestedRoom: '',
  role: 'student',
};

const Profile = () => {
  const { toast } = useToast();
  const { user, token, login } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewObjectUrlRef = useRef<string | null>(null);

  const [profile, setProfile] = useState<ProfileState>(emptyProfile);
  const [hostels, setHostels] = useState<Array<{ _id: string; name: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Personal recovery email state
  const [newRecoveryEmail, setNewRecoveryEmail] = useState('');
  const [recoveryOtp, setRecoveryOtp] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [showRecoveryForm, setShowRecoveryForm] = useState(false);

  const isAdmin = profile.role === 'admin' || profile.role === 'warden' || user?.role === 'admin' || user?.role === 'warden';

  const updateProfile = (patch: Partial<ProfileState>) => {
    setProfile((current) => ({ ...current, ...patch }));
  };

  const syncAuthUser = (updatedProfile: ProfileState, authToken?: string | null) => {
    if (!user || !authToken) {
      return;
    }

    login(
      {
        ...user,
        ...updatedProfile,
      },
      authToken
    );
  };

  const loadProfile = async () => {
    if (!user?.email) {
      setError('User not found. Please log in again.');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await authenticatedFetch(API_ENDPOINTS.PROFILE);

      if (!response.ok) {
        throw new Error('Failed to fetch profile data');
      }

      const data = await response.json();

      if (!data.success || !data.data) {
        throw new Error('Invalid profile response');
      }

      setProfile({
        ...emptyProfile,
        ...data.data,
        profileImage: data.data.profileImage || '',
        designation: data.data.designation || '',
        emergencyContact: data.data.emergencyContact || '',
        hostel: data.data.hostel || '',
        prn: data.data.prn || '',
        floor: data.data.floor || '',
        roomNumber: data.data.roomNumber || '',
        roomLocked: data.data.roomLocked || false,
        roomChangeRequested: data.data.roomChangeRequested || false,
        requestedRoom: data.data.requestedRoom || '',
        role: data.data.role || user.role,
      });
      setIsEditing(false);
    } catch (fetchError) {
      console.error('Error fetching profile:', fetchError);
      setError('Failed to load profile data. Please try again.');
      toast({
        title: 'Error',
        description: 'Failed to load profile data.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();

    // Load hostel list for the dropdown
    authenticatedFetch(API_ENDPOINTS.HOSTELS)
      .then((r) => r.json())
      .then((d) => { if (d?.data) setHostels(d.data); })
      .catch(() => {});

    return () => {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const payload: Record<string, string> = {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone,
        emergencyContact: profile.emergencyContact,
      };

      if (isAdmin) {
        payload.designation = profile.designation;
        payload.hostel = profile.hostel;
      } else {
        payload.hostel = profile.hostel;
        payload.floor = profile.floor;
        payload.roomNumber = profile.roomNumber;
      }

      const response = await authenticatedFetch(API_ENDPOINTS.PROFILE, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      const data = await response.json();

      if (!data.success || !data.data) {
        throw new Error(data.message || 'Failed to update profile');
      }

      const updatedProfile: ProfileState = {
        ...profile,
        ...data.data,
        profileImage: data.data.profileImage || profile.profileImage,
        designation: data.data.designation || profile.designation,
        emergencyContact: data.data.emergencyContact || profile.emergencyContact,
        hostel: data.data.hostel || profile.hostel,
        roomLocked: data.data.roomLocked ?? profile.roomLocked,
        roomChangeRequested: data.data.roomChangeRequested ?? profile.roomChangeRequested,
        requestedRoom: data.data.requestedRoom || profile.requestedRoom,
      };

      setProfile(updatedProfile);
      setIsEditing(false);
      syncAuthUser(updatedProfile, data.data.token || token);

      toast({
        title: 'Profile Updated',
        description: isAdmin
          ? 'Admin profile details updated successfully.'
          : updatedProfile.roomChangeRequested
            ? 'Room change request submitted. Waiting for admin approval.'
            : 'Your profile has been successfully updated.',
      });
    } catch (saveError) {
      console.error('Error updating profile:', saveError);
      toast({
        title: 'Error',
        description: 'Failed to update profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    void loadProfile();
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a JPG or PNG image.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Image too large',
        description: 'Please upload an image smaller than 5MB.',
        variant: 'destructive',
      });
      return;
    }

    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current);
    }

    const temporaryPreview = URL.createObjectURL(file);
    previewObjectUrlRef.current = temporaryPreview;
    updateProfile({ profileImage: temporaryPreview });
    setIsUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append('profileImage', file);

      const response = await authenticatedFetch(API_ENDPOINTS.PROFILE_UPLOAD_IMAGE, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload profile image');
      }

      const data = await response.json();

      if (!data.success || !data.data) {
        throw new Error(data.message || 'Failed to upload profile image');
      }

      const serverImage = data.data.profileImage || '';

      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }

      const updatedProfile = {
        ...profile,
        ...data.data,
        profileImage: serverImage,
      };

      setProfile(updatedProfile);
      syncAuthUser(updatedProfile, data.data.token || token);

      toast({
        title: 'Profile photo updated',
        description: 'Your new profile image has been saved.',
      });
    } catch (uploadError) {
      console.error('Error uploading profile image:', uploadError);

      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }

      updateProfile({ profileImage: profile.profileImage });
      toast({
        title: 'Upload failed',
        description: 'Please try another JPG or PNG image under 5MB.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSendRecoveryOtp = async () => {
    if (!newRecoveryEmail || !/^\S+@\S+\.\S+$/.test(newRecoveryEmail)) {
      toast({
        title: 'Invalid email',
        description: 'Please enter a valid personal recovery email address.',
        variant: 'destructive',
      });
      return;
    }
    setIsSendingOtp(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.RECOVERY_EMAIL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recoveryEmail: newRecoveryEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to send recovery OTP');
      }
      setOtpSent(true);
      toast({
        title: 'Verification Code Sent',
        description: `A 6-digit code was sent to ${newRecoveryEmail}. Check your inbox.`,
      });
    } catch (err: unknown) {
      toast({
        title: 'Error sending code',
        description: err instanceof Error ? err.message : 'Could not send verification code.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyRecoveryOtp = async () => {
    if (!recoveryOtp || recoveryOtp.trim().length !== 6) {
      toast({
        title: 'Invalid code',
        description: 'Please enter the 6-digit verification code.',
        variant: 'destructive',
      });
      return;
    }
    setIsVerifyingOtp(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.VERIFY_RECOVERY_EMAIL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: recoveryOtp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to verify recovery email');
      }
      setProfile((prev) => ({
        ...prev,
        recoveryEmail: data.data?.recoveryEmail || newRecoveryEmail,
        isRecoveryEmailVerified: true,
      }));
      setOtpSent(false);
      setRecoveryOtp('');
      setNewRecoveryEmail('');
      toast({
        title: 'Recovery Email Verified!',
        description: 'Your personal recovery email has been securely linked and verified.',
      });
    } catch (err: unknown) {
      toast({
        title: 'Verification failed',
        description: err instanceof Error ? err.message : 'Invalid or expired verification code.',
        variant: 'destructive',
      });
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const getInitials = () => {
    const firstInitial = profile.firstName ? profile.firstName.charAt(0) : '';
    const lastInitial = profile.lastName ? profile.lastName.charAt(0) : '';
    const initials = `${firstInitial}${lastInitial}`.trim();
    return initials ? initials.toUpperCase() : 'U';
  };

  const getImageSource = () => {
    const source = profile.profileImage;

    if (!source) {
      return '';
    }

    if (source.startsWith('blob:') || /^https?:\/\//i.test(source)) {
      return source;
    }

    return resolveAssetUrl(source);
  };

  const formatHostel = (hostelValue: string) => {
    if (!hostelValue) {
      return isAdmin ? 'Not assigned' : 'Not provided';
    }

    const normalized = hostelValue.toLowerCase();
    if (normalized === 'voila') return 'Voila Hostel';
    if (normalized === 'magnolia') return 'Magnolia Hostel';
    return hostelValue;
  };

  const profileImageSource = getImageSource();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900">
      <Navigation />

      <div className="relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-64 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 opacity-95" />
        <div className="absolute left-10 top-20 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute right-4 top-32 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />

        <div className="container relative mx-auto px-4 py-10 sm:px-6 lg:px-8">
          <div className="mb-8 rounded-3xl border border-white/10 bg-white/80 p-6 shadow-2xl shadow-slate-900/5 backdrop-blur">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
                  <Shield className="h-3.5 w-3.5" />
                  {isAdmin ? 'Admin Profile' : 'Student Profile'}
                </div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
                  Profile Management
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-600 md:text-base">
                  Manage account details, update your profile picture, and keep your contact information current.
                </p>
              </div>
              <Badge className="w-fit rounded-full bg-slate-900 px-4 py-1.5 text-sm text-white hover:bg-slate-900">
                {isAdmin ? 'Administrator' : 'Student'}
              </Badge>
            </div>
          </div>

          {isLoading ? (
            <Card className="border-slate-200/70 shadow-xl shadow-slate-900/5">
              <CardContent className="py-16">
                <div className="flex items-center justify-center gap-3 text-slate-600">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Loading profile data...</span>
                </div>
              </CardContent>
            </Card>
          ) : error ? (
            <Card className="border-red-200 shadow-xl shadow-slate-900/5">
              <CardContent className="py-10">
                <div className="flex items-start gap-4">
                  <AlertCircle className="mt-0.5 h-6 w-6 text-red-600" />
                  <div>
                    <h3 className="font-semibold text-red-700">Error loading profile</h3>
                    <p className="mt-1 text-sm text-slate-600">{error}</p>
                    <Button className="mt-4" variant="outline" onClick={() => void loadProfile()}>
                      Try Again
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
              <Card className="border-slate-200/70 shadow-2xl shadow-slate-900/5">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl">Profile Overview</CardTitle>
                      <CardDescription>
                        {isAdmin ? 'Role-focused admin details' : 'Your personal and hostel information'}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      {isAdmin ? 'Admin' : 'Student'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  <div className="flex flex-col items-center text-center">
                    <button
                      type="button"
                      onClick={handleAvatarClick}
                      className="group relative outline-none"
                      aria-label="Upload profile image"
                    >
                      <Avatar className="h-32 w-32 border-4 border-white shadow-xl shadow-slate-900/10 ring-1 ring-slate-200">
                        <AvatarImage src={profileImageSource} alt={`${profile.firstName} ${profile.lastName}`} className="object-cover" />
                        <AvatarFallback className="bg-gradient-to-br from-slate-900 to-slate-700 text-3xl font-semibold text-white">
                          {getInitials()}
                        </AvatarFallback>
                      </Avatar>

                      <div className="absolute inset-0 flex items-end justify-center rounded-full bg-slate-950/0 transition group-hover:bg-slate-950/30">
                        <div className="mb-3 flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-900 opacity-0 shadow-lg transition group-hover:opacity-100">
                          <Camera className="h-3.5 w-3.5" />
                          {isUploadingImage ? 'Uploading...' : 'Change photo'}
                        </div>
                      </div>
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      className="hidden"
                      onChange={handleImageUpload}
                    />

                    <h2 className="mt-5 text-2xl font-semibold tracking-tight">
                      {profile.firstName || 'User'} {profile.lastName}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">{profile.email}</p>

                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <Badge className="rounded-full bg-slate-900 px-3 py-1 text-white hover:bg-slate-900">
                        {isAdmin ? 'Administrator' : 'Resident Student'}
                      </Badge>
                      {isAdmin ? (
                        profile.designation ? (
                          <Badge variant="outline" className="rounded-full px-3 py-1">
                            {profile.designation}
                          </Badge>
                        ) : null
                      ) : (
                        <Badge variant="outline" className="rounded-full px-3 py-1">
                          PRN {profile.prn || 'Not available'}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
                    <div className="flex items-center gap-3 text-sm text-slate-700">
                      <Mail className="h-4 w-4 text-slate-500" />
                      <span className="truncate">{profile.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-700">
                      <Phone className="h-4 w-4 text-slate-500" />
                      <span>{profile.phone || 'Phone not provided'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-700">
                      <Building2 className="h-4 w-4 text-slate-500" />
                      <span>{formatHostel(profile.hostel)}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-slate-700">
                      <MapPin className="h-4 w-4 text-slate-500" />
                      <span>
                        {isAdmin
                          ? profile.designation || 'No designation set'
                          : profile.roomNumber
                            ? `Room ${profile.roomNumber}`
                            : 'Room not assigned'}
                      </span>
                    </div>
                  </div>

                  {!isAdmin && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 text-amber-700" />
                        <div>
                          <h4 className="font-semibold text-amber-900">Student room allocation</h4>
                          <p className="mt-1 text-sm text-amber-900/80">
                            {profile.roomLocked
                              ? 'Your room assignment is locked and changes require admin approval.'
                              : 'Your room assignment can be updated from this profile.'}
                          </p>
                          {profile.roomChangeRequested && profile.requestedRoom ? (
                            <p className="mt-2 text-sm font-medium text-amber-900">
                              Pending request for room {profile.requestedRoom}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-8 min-w-0">
                <Card className="border-slate-200/70 shadow-2xl shadow-slate-900/5">
                <CardHeader className="border-b border-slate-100 pb-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <CardTitle className="text-xl">Edit Profile</CardTitle>
                      <CardDescription>
                        {isAdmin
                          ? 'Update role-specific information for the admin account.'
                          : 'Update your personal details and hostel allocation.'}
                      </CardDescription>
                    </div>

                    {!isEditing ? (
                      <Button variant="outline" onClick={() => setIsEditing(true)}>
                        <Edit3 className="mr-2 h-4 w-4" />
                        Edit Profile
                      </Button>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={handleCancel}>
                          <X className="mr-2 h-4 w-4" />
                          Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving || isUploadingImage}>
                          {isSaving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="mr-2 h-4 w-4" />
                          )}
                          Save Changes
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-8 pt-6">
                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        value={profile.firstName}
                        disabled={!isEditing}
                        onChange={(event) => updateProfile({ firstName: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        value={profile.lastName}
                        disabled={!isEditing}
                        onChange={(event) => updateProfile({ lastName: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={profile.email}
                        disabled={!isEditing}
                        onChange={(event) => updateProfile({ email: event.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        value={profile.phone}
                        disabled={!isEditing}
                        onChange={(event) => updateProfile({ phone: event.target.value })}
                      />
                    </div>
                  </div>

                  {isAdmin ? (
                    <div className="grid gap-5 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="designation">Designation</Label>
                        <Input
                          id="designation"
                          value={profile.designation}
                          disabled={!isEditing}
                          placeholder="Optional"
                          onChange={(event) => updateProfile({ designation: event.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hostel">Hostel Assigned</Label>
                        <Input
                          id="hostel"
                          value={profile.hostel}
                          disabled={!isEditing}
                          placeholder="Optional"
                          onChange={(event) => updateProfile({ hostel: event.target.value })}
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="emergencyContact">Emergency Contact</Label>
                        <Input
                          id="emergencyContact"
                          type="tel"
                          value={profile.emergencyContact}
                          disabled={!isEditing}
                          onChange={(event) => updateProfile({ emergencyContact: event.target.value })}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-slate-700">
                          <User className="h-4 w-4" />
                          Student identity
                        </div>

                        <div className="grid gap-5 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="prn">PRN</Label>
                            <Input id="prn" value={profile.prn} disabled className="bg-slate-100" />
                            <p className="text-xs text-slate-500">PRN cannot be changed</p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="hostel">Hostel</Label>
                            <Select
                              value={profile.hostel}
                              disabled={!isEditing || profile.roomLocked}
                              onValueChange={(value) => updateProfile({ hostel: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select hostel" />
                              </SelectTrigger>
                              <SelectContent>
                                {hostels.length > 0
                                  ? hostels.map((h) => (
                                      <SelectItem key={h._id} value={h.name}>{h.name}</SelectItem>
                                    ))
                                  : (
                                    <>
                                      <SelectItem value="Voila Hostel">Voila Hostel</SelectItem>
                                      <SelectItem value="Orchid Hostel">Orchid Hostel</SelectItem>
                                      <SelectItem value="Magnolia Hostel">Magnolia Hostel</SelectItem>
                                      <SelectItem value="Symbiosis Royal Hostel">Symbiosis Royal Hostel</SelectItem>
                                    </>
                                  )}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="floor">Floor</Label>
                            <Select
                              value={profile.floor}
                              disabled={!isEditing || profile.roomLocked}
                              onValueChange={(value) => updateProfile({ floor: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select floor" />
                              </SelectTrigger>
                              <SelectContent>
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((floor) => (
                                  <SelectItem key={floor} value={floor.toString()}>
                                    Floor {floor}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="roomNumber">Room Number</Label>
                            <Input
                              id="roomNumber"
                              value={profile.roomNumber}
                              disabled={!isEditing || profile.roomLocked}
                              onChange={(event) => updateProfile({ roomNumber: event.target.value })}
                            />
                          </div>
                        </div>

                        {isEditing && profile.roomLocked ? (
                          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                            Room details are locked. Changes will create a room change request.
                            {profile.roomChangeRequested && profile.requestedRoom ? (
                              <span className="block font-medium">Pending room request: {profile.requestedRoom}</span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="emergencyContact">Emergency Contact</Label>
                        <Input
                          id="emergencyContact"
                          type="tel"
                          value={profile.emergencyContact}
                          disabled={!isEditing}
                          onChange={(event) => updateProfile({ emergencyContact: event.target.value })}
                        />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Personal Recovery Email Card */}
              <Card className="border-slate-200/70 shadow-2xl shadow-slate-900/5">
                <CardHeader className="border-b border-slate-100 pb-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                      <KeyRound className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Personal Recovery Email</CardTitle>
                      <CardDescription>
                        Link a verified personal email address (e.g., Gmail, Yahoo) to recover your account if you lose access to your institutional inbox.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  {profile.isRecoveryEmailVerified && profile.recoveryEmail && !showRecoveryForm ? (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 px-3 py-1">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Verified Recovery Email
                            </Badge>
                          </div>
                          <p className="text-base font-semibold text-slate-800 pt-1">
                            {profile.recoveryEmail}
                          </p>
                          <p className="text-xs text-slate-500">
                            Password reset links can be dispatched to this verified address if requested.
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-fit border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                          onClick={() => setShowRecoveryForm(true)}
                        >
                          Update Recovery Email
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {!otpSent ? (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="recoveryEmailInput">Personal Email Address</Label>
                            <div className="flex flex-col sm:flex-row gap-3">
                              <Input
                                id="recoveryEmailInput"
                                type="email"
                                placeholder="e.g. personal.name@gmail.com"
                                value={newRecoveryEmail}
                                onChange={(e) => setNewRecoveryEmail(e.target.value)}
                                className="max-w-md"
                              />
                              <Button
                                type="button"
                                onClick={handleSendRecoveryOtp}
                                disabled={isSendingOtp || !newRecoveryEmail}
                                className="shrink-0"
                              >
                                {isSendingOtp ? (
                                  <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Sending Code...
                                  </>
                                ) : (
                                  <>
                                    <Mail className="mr-2 h-4 w-4" />
                                    Send Verification Code
                                  </>
                                )}
                              </Button>
                            </div>
                            <p className="text-xs text-slate-500">
                              We will send a 6-digit one-time code to verify ownership.
                            </p>
                          </div>
                          {profile.isRecoveryEmailVerified && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setShowRecoveryForm(false);
                                setNewRecoveryEmail('');
                              }}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/60 p-4">
                          <div className="space-y-1">
                            <h4 className="text-sm font-semibold text-blue-900">Enter Verification Code</h4>
                            <p className="text-xs text-blue-700">
                              Enter the 6-digit code sent to <span className="font-semibold">{newRecoveryEmail}</span>. The code expires in 10 minutes.
                            </p>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-3">
                            <Input
                              id="recoveryOtpInput"
                              type="text"
                              maxLength={6}
                              placeholder="123456"
                              value={recoveryOtp}
                              onChange={(e) => setRecoveryOtp(e.target.value)}
                              className="max-w-[200px] text-center tracking-widest text-lg font-mono"
                            />
                            <Button
                              type="button"
                              onClick={handleVerifyRecoveryOtp}
                              disabled={isVerifyingOtp || recoveryOtp.trim().length !== 6}
                            >
                              {isVerifyingOtp ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Verifying...
                                </>
                              ) : (
                                <>
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  Verify & Link Email
                                </>
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                setOtpSent(false);
                                setRecoveryOtp('');
                              }}
                            >
                              Back
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
            </div>
          )}
        </div>
      </div>

      <Footer />

      {isUploadingImage ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-xl">
          Uploading profile photo...
        </div>
      ) : null}
    </div>
  );
};

export default Profile;