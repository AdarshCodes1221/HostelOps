import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import React from "react";
import Index from "./pages/Index";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Complaints from "./pages/Complaints";
import ComplaintDetail from "./pages/ComplaintDetail";
import MessMenu from "./pages/MessMenu";
import BusRoutes from "./pages/BusRoutes";
import NoticeBoard from "./pages/NoticeBoard";
import Profile from "./pages/Profile";
import Portfolio from "./pages/Portfolio";
import NotFound from "./pages/NotFound";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AdminForgotPassword from "./pages/AdminForgotPassword";
import AdminResetPassword from "./pages/AdminResetPassword";
import ClearStorage from "./pages/ClearStorage";
import VerifyEmail from "./pages/VerifyEmail";
import Outpass from "./pages/Outpass";
import VerifyOutpass from "./pages/VerifyOutpass";
import WardenDashboard from "./pages/WardenDashboard";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import SecurityDashboard from "./pages/SecurityDashboard";

// Error Boundary to prevent white screens
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('🔴 Uncaught error:', error.message);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
            <p className="text-muted-foreground mb-4 text-sm">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false });
                window.location.href = '/';
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition"
            >
              Return Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
          <Routes>
            {/* Public Routes - Anyone can access */}
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Login />} />
            <Route path="/signup" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/admin/login" element={<Login />} />
            <Route path="/security/login" element={<Login />} />
            <Route path="/admin/forgot-password" element={<AdminForgotPassword />} />
            <Route path="/admin/reset-password/:token" element={<AdminResetPassword />} />
            <Route path="/admin/reset-password" element={<AdminResetPassword />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/clear-storage" element={<ClearStorage />} />
            <Route path="/verify-email/:token" element={<VerifyEmail />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/verify-outpass" element={<VerifyOutpass />} />
            <Route path="/notices" element={<ProtectedRoute><NoticeBoard /></ProtectedRoute>} />
            <Route path="/rooms" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/users" element={<ProtectedRoute requireAdmin={true}><AdminDashboard defaultTab="users" /></ProtectedRoute>} />
            <Route path="/admin/complaints" element={<ProtectedRoute requireAdmin={true}><AdminDashboard defaultTab="complaints" /></ProtectedRoute>} />
            <Route path="/admin/rooms" element={<ProtectedRoute requireAdmin={true}><AdminDashboard defaultTab="rooms" /></ProtectedRoute>} />
            <Route path="/admin/bookings" element={<ProtectedRoute requireAdmin={true}><AdminDashboard defaultTab="bookings" /></ProtectedRoute>} />
            <Route path="/admin/mess-menu" element={<ProtectedRoute requireAdmin={true}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/notices" element={<ProtectedRoute requireAdmin={true}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/outpass/admin/all" element={<ProtectedRoute requireAdmin={true}><AdminDashboard defaultTab="outpasses" /></ProtectedRoute>} />

            {/* Student Only Routes - Must be logged in as student */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute requireStudent={true}>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute requireStudent={true}>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/outpass/my"
              element={
                <ProtectedRoute requireStudent={true}>
                  <Outpass />
                </ProtectedRoute>
              }
            />
            <Route
              path="/complaints"
              element={
                <ProtectedRoute requireStudent={true}>
                  <Complaints />
                </ProtectedRoute>
              }
            />
            <Route
              path="/complaints/:id"
              element={
                <ProtectedRoute requireStudent={true}>
                  <ComplaintDetail />
                </ProtectedRoute>
              }
            />

            {/* Generally Authenticated Routes - Any logged-in user can access */}
            <Route
              path="/mess-menu"
              element={
                <ProtectedRoute>
                  <MessMenu />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bus-routes"
              element={
                <ProtectedRoute>
                  <BusRoutes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notice-board"
              element={
                <ProtectedRoute>
                  <NoticeBoard />
                </ProtectedRoute>
              }
            />

            {/* Admin Only Routes - Must be logged in as admin */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute requireAdmin={true}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Warden Only Routes - Must be logged in as warden */}
            <Route
              path="/warden/dashboard"
              element={
                <ProtectedRoute requireWarden={true}>
                  <WardenDashboard defaultTab="dashboard" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/warden/hostel"
              element={
                <ProtectedRoute requireWarden={true}>
                  <WardenDashboard defaultTab="hostel" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/warden/students"
              element={
                <ProtectedRoute requireWarden={true}>
                  <WardenDashboard defaultTab="students" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/warden/pending-students"
              element={
                <ProtectedRoute requireWarden={true}>
                  <WardenDashboard defaultTab="pending" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/warden/complaints"
              element={
                <ProtectedRoute requireWarden={true}>
                  <WardenDashboard defaultTab="complaints" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/warden/outpasses"
              element={
                <ProtectedRoute requireWarden={true}>
                  <WardenDashboard defaultTab="outpasses" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/warden/gate-activity"
              element={
                <ProtectedRoute requireWarden={true}>
                  <WardenDashboard defaultTab="gate" />
                </ProtectedRoute>
              }
            />

            {/* Super Admin Only Routes - Must be logged in as super admin */}
            <Route
              path="/super-admin/dashboard"
              element={
                <ProtectedRoute requireSuperAdmin={true}>
                  <SuperAdminDashboard />
                </ProtectedRoute>
              }
            />

            {/* Security Only Routes - Must be logged in as security */}
            <Route
              path="/security/dashboard"
              element={
                <ProtectedRoute requireSecurity={true}>
                  <SecurityDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/security/attendance"
              element={
                <ProtectedRoute requireSecurity={true}>
                  <SecurityDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/outpass/verify-qr"
              element={
                <ProtectedRoute requireSecurity={true}>
                  <VerifyOutpass />
                </ProtectedRoute>
              }
            />

            {/* 404 - Catch all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;