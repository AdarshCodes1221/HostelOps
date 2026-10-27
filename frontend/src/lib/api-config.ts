/**
 * API Configuration & Authentication
 * 
 * This file handles all backend communication setup.
 * It automatically adds JWT tokens to requests so you don't have to!
 * 
 * Why this file exists:
 * - Single source of truth for API configuration
 * - Easy to change API URL for production
 * - Automatic JWT token attachment (security)
 * - Centralized endpoint definitions
 */

/**
 * Base API URL Configuration
 * 
 * How it works:
 * 1. First, check if VITE_API_URL environment variable is set
 * 2. If not set, use localhost for development
 * 
 * For Production:
 * Set environment variable: VITE_API_URL=https://api.yourhostellms.com/api
 * 
 * For Development (local):
 * Defaults to: http://localhost:5000/api
 */
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * authenticatedFetch() - Smart API Request Function
 * 
 * This function makes API requests AND automatically attaches the JWT token.
 * You don't need to manually add the Authorization header!
 * 
 * What it does:
 * 1. Gets JWT token from localStorage
 * 2. Adds it to the Authorization header
 * 3. Makes the fetch request
 * 4. Returns the response
 * 
 * Usage Example:
 * 
 * // Without token (automatic!)
 * const response = await authenticatedFetch('/users/profile');
 * const data = await response.json();
 * 
 * // The function automatically adds:
 * // Authorization: Bearer <your-jwt-token>
 * 
 * How the Authorization header works:
 * - Format: "Bearer <token>"
 * - Backend checks this header for every protected request
 * - If token is missing or invalid → Backend returns 401 Unauthorized
 * - If token is valid → Backend allows the request
 */
export async function authenticatedFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  // Get token from localStorage (saved when user logs in)
  const token = localStorage.getItem('token');
  const isFormData = options.body instanceof FormData;
  
  // Build headers
  const headers = {
    // Only set JSON content type when not sending FormData (browser sets multipart boundary automatically)
    ...(!isFormData && { 'Content-Type': 'application/json' }),
    // Only add Authorization header if token exists
    ...(token && { Authorization: `Bearer ${token}` }),
    // Merge any custom headers passed in
    ...options.headers,
  };

  // Make the request with automatic token attachment and cookie support
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    credentials: 'include',
    ...options,
    headers,
  });

  // Handle expired or invalid session
  if (response.status === 401 && token) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('auth:unauthorized'));
  }

  return response;
}


export const resolveAssetUrl = (assetPath?: string) => {
  if (!assetPath) {
    return '';
  }

  if (/^https?:\/\//i.test(assetPath)) {
    return assetPath;
  }

  const baseUrl = API_BASE_URL.replace(/\/api\/?$/, '');
  const normalizedPath = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;

  return `${baseUrl}${normalizedPath}`;
};

/**
 * API Endpoints Configuration
 * 
 * Instead of hardcoding URLs everywhere, define them here.
 * Benefits:
 * - Easy to find and update endpoints
 * - Prevents typos (URL as string → static property)
 * - Clear documentation of available endpoints
 * 
 * Usage:
 * import { API_ENDPOINTS } from '@/lib/api-config';
 * 
 * // Instead of:
 * fetch('/api/users/profile')
 * 
 * // Do this:
 * authenticatedFetch(API_ENDPOINTS.PROFILE)
 * 
 * // Or for endpoints with parameters:
 * fetch(API_ENDPOINTS.ADMIN_USER_DELETE('user123'))
 * // → /api/admin/users/user123
 */
export const API_ENDPOINTS = {
  // User endpoints
  LOGIN: '/users/login',           // POST - Log in with email + password
  LOGOUT: '/users/logout',         // POST - Logout student and clear cookie
  REGISTER: '/users/register',     // POST - Create new student account
  VERIFY_EMAIL: '/users/verify-email', // POST - Verify email with token
  RESEND_VERIFICATION: '/users/resend-verification', // POST - Resend verification email
  FORGOT_PASSWORD: '/users/forgot-password', // POST - Request password reset link
  RESET_PASSWORD: (token: string) => `/users/reset-password/${token}`, // POST - Reset password with token
  PROFILE: '/profile',             // GET/PUT - Get or update current profile
  PROFILE_UPLOAD_IMAGE: '/profile/upload-image', // POST - Upload profile image
  LEGACY_PROFILE: '/users/profile', // Backward-compatible profile endpoint
  RECOVERY_EMAIL: '/users/recovery-email', // POST - Request OTP to verify personal recovery email
  VERIFY_RECOVERY_EMAIL: '/users/verify-recovery-email', // POST - Verify recovery email OTP
  
  // Admin endpoints (dedicated admin portal & management)
  ADMIN_LOGIN: '/admin/login',                    // POST - Dedicated admin login
  ADMIN_LOGOUT: '/admin/logout',                  // POST - Dedicated admin logout
  ADMIN_FORGOT_PASSWORD: '/admin/forgot-password', // POST - Admin password reset request
  ADMIN_RESET_PASSWORD: (token: string) => `/admin/reset-password/${token}`, // POST - Admin password reset
  ADMIN_DASHBOARD: '/admin/dashboard',            // GET - Admin dashboard stats
  ADMIN_USERS: '/admin/users',                    // GET - List all users
  ADMIN_ROOMS: '/admin/rooms',                    // GET - Rooms with occupancy (admin only)
  ADMIN_PENDING_STUDENTS: '/admin/pending-students', // GET - Students waiting for review & room allocation
  ADMIN_APPROVE_STUDENT: (id: string) => `/admin/students/${id}/approve-and-allocate`, // POST - Approve & assign room
  ADMIN_REJECT_STUDENT: (id: string) => `/admin/students/${id}/reject`, // POST - Reject registration
  ADMIN_REASSIGN_ROOM: (id: string) => `/admin/students/${id}/reassign-room`, // PUT - Reassign student room
  ADMIN_ROOM_OCCUPANT_ADD: (roomId: string) => `/admin/rooms/${roomId}/occupants`, // POST - add student
  ADMIN_ROOM_OCCUPANT_REMOVE: (roomId: string, userId: string) => `/admin/rooms/${roomId}/occupants/${userId}`, // DELETE - remove student
  ADMIN_USER_DELETE: (userId: string) => `/admin/users/${userId}`,  // DELETE user
  ADMIN_USER_ROLE: (userId: string) => `/admin/users/${userId}/role`,  // Update user role
  ADMIN_SEARCH_STUDENT: (prn: string) => `/admin/students/${prn}`,  // GET - Search student by PRN
  ADMIN_APPROVE_ROOM_CHANGE: (id: string) => `/admin/students/${id}/approve-room-change`,  // PUT - Approve room change
  ADMIN_REJECT_ROOM_CHANGE: (id: string) => `/admin/students/${id}/reject-room-change`,  // PUT - Reject room change
  
  // Complaint endpoints
  COMPLAINTS_CREATE: '/complaints',               // POST - Create complaint (student only)
  COMPLAINTS_MY: '/complaints/my',                // GET - Get my complaints (student)
  ADMIN_COMPLAINTS: '/admin/complaints',          // GET - Get all complaints (admin)
  ADMIN_COMPLAINT_UPDATE: (id: string) => `/admin/complaints/${id}`,  // PATCH - Update complaint (admin)
  ADMIN_COMPLAINT_DELETE: (id: string) => `/admin/complaints/${id}`,  // DELETE - Delete complaint (admin)
  
  // Mess menu endpoints
  MESS_MENU_ALL: '/mess-menu',                    // GET - Get all menus (public)
  MESS_MENU_LATEST: '/mess-menu/latest',          // GET - Get latest active menu image (public)
  MESS_MENU_CREATE: '/mess-menu',                 // POST - Create menu (admin only)
  MESS_MENU_UPDATE: (id: string) => `/mess-menu/${id}`,  // PUT - Update menu (admin)
  MESS_MENU_BATCH: '/mess-menu/batch',            // POST - Batch create from OCR (admin)
  MESS_MENU_UPLOAD_IMAGE: '/mess-menu/upload-image', // POST - Upload image fallback (admin)
  
  // Bus route endpoints
  BUS_ROUTES_ALL: '/bus-routes',                  // GET - Get all routes (public)
  BUS_ROUTES_IMAGE: '/bus-routes/image',          // GET - Get route image (public)
  BUS_ROUTES_UPLOAD_IMAGE: '/bus-routes/upload-image', // POST - Upload image (admin)
  BUS_ROUTES_CREATE: '/bus-routes',               // POST - Create route (admin only)
  BUS_ROUTES_UPDATE: (id: string) => `/bus-routes/${id}`,  // PUT - Update route (admin)
  BUS_ROUTES_DELETE: (id: string) => `/bus-routes/${id}`,  // DELETE - Delete route (admin)
  
  // Notification endpoints
  NOTIFICATIONS_MY: '/notifications/my',          // GET - Get user's notifications (private)
  NOTIFICATIONS_UNREAD_COUNT: '/notifications/unread-count', // GET - Unread count
  NOTIFICATION_MARK_READ: (id: string) => `/notifications/${id}/read`, // PUT - Mark read
  NOTIFICATIONS_MARK_ALL_READ: '/notifications/mark-all-read', // PUT - Mark all read
  
  // Notice Board endpoints
  NOTICES_ALL: '/notices',                        // GET - Get all notices (authenticated)
  NOTICES_CREATE: '/notices',                     // POST - Create notice (admin only)
  NOTICES_DELETE: (id: string) => `/notices/${id}`,  // DELETE - Delete notice (admin)
  
  // Hostel endpoints
  HOSTELS: '/hostels',
  HOSTEL_BY_ID: (id: string) => `/hostels/${id}`,
  
  // Room endpoints
  ROOMS: '/rooms',
  ROOM_BY_ID: (id: string) => `/rooms/${id}`,
  
  // Booking endpoints
  BOOKINGS: '/bookings',
  BOOKING_BY_ID: (id: string) => `/bookings/${id}`,
  ADMIN_BOOKING_CONFIRM: (id: string) => `/admin/bookings/${id}/confirm`,
  ADMIN_BOOKING_CANCEL: (id: string) => `/admin/bookings/${id}/cancel`,

  // Outpass & Digital Gate Pass endpoints
  OUTPASS_CREATE: '/outpass',
  OUTPASS_MY: '/outpass/my',
  OUTPASS_BY_ID: (id: string) => `/outpass/${id}`,
  OUTPASS_VERIFY_PUBLIC: '/outpass/verify-public',  // POST - Public read-only pass verification (no auth)
  ADMIN_OUTPASS_ALL: '/outpass/admin/all',
  ADMIN_OUTPASS_APPROVE: (id: string) => `/outpass/admin/${id}/approve`,
  ADMIN_OUTPASS_REJECT: (id: string) => `/outpass/admin/${id}/reject`,
  // Warden endpoints
  WARDEN_DASHBOARD: '/warden/dashboard',
  WARDEN_HOSTEL: '/warden/hostel',
  WARDEN_STUDENTS: '/warden/students',
  WARDEN_PENDING_STUDENTS: '/warden/pending-students',
  WARDEN_COMPLAINTS: '/warden/complaints',
  WARDEN_OUTPASSES: '/warden/outpasses',

  // Super Admin endpoints
  SUPER_ADMIN_DASHBOARD: '/admin/dashboard',            // GET - Super admin dashboard stats (uses admin endpoint)
  SUPER_ADMIN_USERS: '/admin/users',                    // GET - List all users (uses admin endpoint)
  SUPER_ADMIN_USER_ROLE: (id: string) => `/admin/users/${id}/role`,  // Update user role (uses admin endpoint)
  SUPER_ADMIN_USER_DELETE: (id: string) => `/admin/users/${id}`,  // DELETE user (uses admin endpoint)

  // Security Gate endpoints
  SECURITY_VERIFY_QR: '/security/verify-qr',           // POST - Verify QR / pass code
  SECURITY_CHECKOUT: '/security/checkout',              // POST - Check student OUT
  SECURITY_RETURN: '/security/return',                  // POST - Check student IN on return
  SECURITY_GATE_ATTENDANCE: '/security/attendance',     // GET - Gate attendance and movement logs
};
