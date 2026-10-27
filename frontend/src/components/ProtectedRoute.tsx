import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;    // If true, only admins can access
  requireWarden?: boolean;   // If true, only wardens can access
  requireSuperAdmin?: boolean; // If true, only super admins can access
  requireSecurity?: boolean;   // If true, only security personnel can access
  requireStudent?: boolean;    // If true, only students can access
}

/**
 * ProtectedRoute Component
 * 
 * This component protects routes from unauthorized access.
 * Think of it as a security guard at a door:
 * - It checks if you're logged in
 * - It checks your role (student vs admin)
 * - It only lets authorized people through
 * 
 * Usage:
 * 
 * Regular protected route (students can access):
 * <Route path="/dashboard" element={
 *   <ProtectedRoute>
 *     <Dashboard />
 *   </ProtectedRoute>
 * }/>
 * 
 * Admin-only route:
 * <Route path="/admin" element={
 *   <ProtectedRoute requireAdmin={true}>
 *     <AdminDashboard />
 *   </ProtectedRoute>
 * }/>
 * 
 * Security Flow:
 * User tries to access /admin
 *     ↓
 * Is user logged in?
 *     ├─ NO  → Redirect to /login
 *     └─ YES → Is admin route?
 *              ├─ YES and user is admin    → Show content ✅
 *              ├─ YES and user is student  → Redirect to /dashboard ❌
 *              └─ NO                       → Show content ✅
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
  requireWarden = false,
  requireSuperAdmin = false,
  requireSecurity = false,
  requireStudent = false
}) => {
  // Get authentication state from AuthContext
  const { isAuthenticated, isAdmin, isWarden, isSuperAdmin, isSecurity, isLoading, user } = useAuth();

  const canAccessAdmin = isAdmin || isSuperAdmin;
  const canAccessWarden = isWarden || isSuperAdmin;
  const canAccessSecurity = isSecurity || isSuperAdmin;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    console.log('🔒 Access denied: User not authenticated. Redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  if (requireSuperAdmin && !isSuperAdmin) {
    console.log('🔒 Access denied: Super Admin access required. User role:', user?.role);
    if (canAccessAdmin) return <Navigate to="/admin/dashboard" replace />;
    if (isWarden) return <Navigate to="/warden/dashboard" replace />;
    if (isSecurity) return <Navigate to="/security/dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  if (requireAdmin && !canAccessAdmin) {
    console.log('🔒 Access denied: Admin access required. User role:', user?.role);
    if (isWarden) return <Navigate to="/warden/dashboard" replace />;
    if (isSecurity) return <Navigate to="/security/dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  if (requireWarden && !canAccessWarden) {
    console.log('🔒 Access denied: Warden access required. User role:', user?.role);
    if (isAdmin) return <Navigate to="/admin/dashboard" replace />;
    if (isSecurity) return <Navigate to="/security/dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  if (requireSecurity && !canAccessSecurity) {
    console.log('🔒 Access denied: Security access required. User role:', user?.role);
    if (isAdmin) return <Navigate to="/admin/dashboard" replace />;
    if (isWarden) return <Navigate to="/warden/dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  if (requireStudent && !isAuthenticated) {
    // This shouldn't happen due to the !isAuthenticated check above, but just in case
    console.log('🔒 Access denied: Student access required. User not authenticated');
    return <Navigate to="/login" replace />;
  }

  if (requireStudent && (isAdmin || isWarden || isSecurity || isSuperAdmin)) {
    console.log('🔒 Access denied: Student access required. User role:', user?.role);
    // Redirect non-students to their appropriate dashboard
    if (isSuperAdmin) return <Navigate to="/super-admin/dashboard" replace />;
    if (canAccessAdmin) return <Navigate to="/admin/dashboard" replace />;
    if (isWarden) return <Navigate to="/warden/dashboard" replace />;
    if (isSecurity) return <Navigate to="/security/dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  /**
   * Step 4: All checks passed! Show the protected content
   *
   * User is authenticated and has the right role.
   * Show them the requested page.
   */
  console.log('✅ Access granted');
  return <>{children}</>;
};
