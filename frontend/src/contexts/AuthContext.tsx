import React, { createContext, useState, useContext, useEffect } from 'react';
import { API_BASE_URL, API_ENDPOINTS, authenticatedFetch } from '@/lib/api-config';

/**
 * AuthContext - Global Authentication State Management
 * 
 * This context manages the user's authentication state globally across the app.
 * Benefits:
 * - User is available in every component without prop drilling
 * - Auth state persists across page refreshes (via localStorage)
 * - Single source of truth for login/logout/user data
 * 
 * How it works:
 * 1. On app load, checks localStorage for stored token and user
 * 2. If found, restores the user session automatically
 * 3. When user logs in, saves token and user to both state and localStorage
 * 4. When user logs out, clears everything
 */

// Define the shape of our user object
interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  prn?: string;
  profileImage?: string;
  designation?: string;
  hostel?: string;
  roomNumber?: string;
  phone?: string;
  floor?: string;
  emergencyContact?: string;
  roomLocked?: boolean;
  roomChangeRequested?: boolean;
  requestedRoom?: string;
  role: 'student' | 'admin' | 'warden' | 'security' | 'super_admin';
}

// Define the shape of our auth context
interface AuthContextType {
  user: User | null;                              // Currently logged-in user or null
  token: string | null;                           // JWT token or null
  login: (userData: User, token: string) => void; // Function to log in
  logout: () => void;                             // Function to log out
  isAuthenticated: boolean;                       // Computed: is user logged in?
  isAdmin: boolean;                               // Computed: is user an admin?
  isWarden: boolean;                              // Computed: is user a warden?
  isSecurity: boolean;                            // Computed: is user security?
  isSuperAdmin: boolean;                          // Computed: is user super admin?
  isLoading: boolean;                             // Computed: is auth state still loading?
}

// Create the context with default values
const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
  isAdmin: false,
  isWarden: false,
  isSecurity: false,
  isSuperAdmin: false,
  isLoading: true,
});

/**
 * useAuth Hook
 * 
 * Use this in ANY component to access authentication state.
 * 
 * Example:
 * const { user, isAuthenticated, logout } = useAuth();
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * AuthProvider Component
 * 
 * Wrap your entire app with this provider to enable auth functionality:
 * 
 * <AuthProvider>
 *   <App />
 * </AuthProvider>
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => {
    try {
      const t = localStorage.getItem('token');
      return (t && t !== 'undefined' && t !== 'null') ? t : null;
    } catch {
      return null;
    }
  });

  const [user, setUser] = useState<User | null>(() => {
    try {
      const u = localStorage.getItem('user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    // If no token exists at all, we are immediately done loading
    try {
      const t = localStorage.getItem('token');
      return Boolean(t && t !== 'undefined' && t !== 'null');
    } catch {
      return false;
    }
  });

  /**
   * Listen to global 401 unauthorized events to instantly sync logged-out state
   */
  useEffect(() => {
    const handleUnauthorized = () => {
      console.log('🔒 Received auth:unauthorized event - clearing session');
      setUser(null);
      setToken(null);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, []);

  /**
   * Step 1: Check and verify session on app load
   */
  useEffect(() => {
    let isMounted = true;

    const clearSession = () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (isMounted) {
        setUser(null);
        setToken(null);
      }
    };

    const isValidUser = (candidate: any) => {
      return !!(
        candidate &&
        candidate._id &&
        candidate.role &&
        candidate.email &&
        candidate.firstName &&
        candidate.lastName
      );
    };

    const restoreSession = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      // Guard against missing or placeholder tokens
      if (!storedToken || storedToken === 'undefined' || storedToken === 'null' || !storedUser) {
        clearSession();
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        const parsedUser = JSON.parse(storedUser);
        if (!isValidUser(parsedUser)) {
          throw new Error('Invalid user object structure');
        }

        // Validate token with backend
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.PROFILE}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        if (!response.ok) {
          throw new Error('Token validation failed');
        }

        // Prefer server user payload when available
        const data = await response.json().catch(() => null);
        const serverUser = (data && (data.data || data.user)) || parsedUser;

        if (!isValidUser(serverUser)) {
          throw new Error('Server user payload missing required fields');
        }

        // Persist the verified user for refresh continuity
        localStorage.setItem('user', JSON.stringify(serverUser));

        if (isMounted) {
          setToken(storedToken);
          setUser(serverUser);
          console.log('✅ Session restored from verified token');
        }
      } catch (error) {
        console.error('❌ Auth initialization failed:', error);
        clearSession();
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    restoreSession();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Step 2: Login function
   * 
   * Called when user successfully logs in.
   * Saves user and token to BOTH state and localStorage.
   * 
   * Why both? 
   * - State: For immediate re-renders in React
   * - localStorage: So login persists after page refresh
   * 
   * Example:
   * login(
   *   { _id: '123', firstName: 'John', email: 'john@example.com', role: 'student' },
   *   'eyJhbGc...' // JWT token from backend
   * );
   */
  const login = (userData: User, authToken: string) => {
    console.log('✅ User logged in:', userData.email);
    
    // Save to React state
    setUser(userData);
    setToken(authToken);
    
    // Save to localStorage so login persists after refresh
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  /**
   * Step 3: Logout function
   * 
   * Called when user clicks logout.
   * Clears everything: user, token, and localStorage.
   * 
   * After logout:
   * - isAuthenticated becomes false
   * - All protected routes redirect to /login
   * - Navigation bar shows Login button
   */
  const logout = async () => {
    console.log('✅ User logged out');

    // Notify backend to clear HttpOnly cookie on both endpoints
    try {
      await Promise.allSettled([
        authenticatedFetch(API_ENDPOINTS.LOGOUT, { method: 'POST' }),
        authenticatedFetch(API_ENDPOINTS.ADMIN_LOGOUT, { method: 'POST' })
      ]);
    } catch (e) {
      console.error('Logout error:', e);
    }
    
    // Clear from React state
    setUser(null);
    setToken(null);
    
    // Clear from localStorage & sessionStorage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear();
  };

  /**
   * Computed values
   * These are derived from user and token
   */
  
  // User is authenticated if we have BOTH user and token
  const isAuthenticated = !!user && !!token;

  // User is admin if their role is exactly 'admin'
  const isAdmin = user?.role === 'admin';

  // User is warden if their role is exactly 'warden'
  const isWarden = user?.role === 'warden';

  // User is security if their role is exactly 'security'
  const isSecurity = user?.role === 'security';

  // User is super admin if their role is exactly 'super_admin'
  const isSuperAdmin = user?.role === 'super_admin';

  // Package everything into one object
  const value = {
    user,
    token,
    login,
    logout,
    isAuthenticated,
    isAdmin,
    isWarden,
    isSecurity,
    isSuperAdmin,
    isLoading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
