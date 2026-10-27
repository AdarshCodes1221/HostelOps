# Authentication Architecture - Simple Explanation

## How Everything Connects

```
┌─────────────────────────────────────────────────────────────┐
│                       USER BROWSER                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    REACT FRONTEND                           │
│                  (hostel-compass/)                          │
│                                                             │
│  ┌───────────────────────────────────────────────────┐    │
│  │  App.tsx (Main App)                               │    │
│  │  Wrapped with AuthProvider                        │    │
│  └───────────────────────────────────────────────────┘    │
│                      │                                      │
│                      ▼                                      │
│  ┌───────────────────────────────────────────────────┐    │
│  │  AuthContext (Global State)                       │    │
│  │  • user                                            │    │
│  │  • token                                           │    │
│  │  • isAuthenticated                                 │    │
│  │  • isAdmin                                         │    │
│  │  • login()                                         │    │
│  │  • logout()                                        │    │
│  │                                                    │    │
│  │  Saves to: localStorage                           │    │
│  └───────────────────────────────────────────────────┘    │
│                      │                                      │
│         ┌────────────┴────────────┐                        │
│         ▼                         ▼                        │
│  ┌──────────┐            ┌──────────────┐                 │
│  │Navigation│            │ProtectedRoute│                 │
│  │          │            │               │                 │
│  │Shows:    │            │Checks:        │                 │
│  │Login or  │            │isAuthenticated│                 │
│  │Logout    │            │isAdmin        │                 │
│  └──────────┘            └──────────────┘                 │
│                                  │                          │
│                                  ▼                          │
│  ┌────────────────────────────────────────────┐           │
│  │            Protected Pages                 │           │
│  │  • Dashboard (any logged in user)          │           │
│  │  • AdminDashboard (admin only)             │           │
│  │  • Profile, Complaints, etc.               │           │
│  └────────────────────────────────────────────┘           │
│                                                             │
│         API Calls                                          │
│  ┌───────────────────────────────────────────────────┐    │
│  │  api-config.ts                                    │    │
│  │  • API_BASE_URL                                   │    │
│  │  • authenticatedFetch()                           │    │
│  │    - Auto-adds JWT token to headers              │    │
│  └───────────────────────────────────────────────────┘    │
└───────────────────────│─────────────────────────────────────┘
                        │
                        ▼ HTTP Requests with JWT Token
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND SERVER                           │
│                     (backend/)                              │
│                                                             │
│  ┌───────────────────────────────────────────────────┐    │
│  │  Routes                                           │    │
│  │  • /api/users/login                               │    │
│  │  • /api/users/register                            │    │
│  │  • /api/admin/* (protected)                       │    │
│  └───────────────────────────────────────────────────┘    │
│                      │                                      │
│                      ▼                                      │
│  ┌───────────────────────────────────────────────────┐    │
│  │  Auth Middleware                                  │    │
│  │  Checks JWT token validity                        │    │
│  │  Verifies user role                               │    │
│  └───────────────────────────────────────────────────┘    │
│                      │                                      │
│                      ▼                                      │
│  ┌───────────────────────────────────────────────────┐    │
│  │  Controllers                                      │    │
│  │  • userController.js                              │    │
│  │  • adminController.js                             │    │
│  └───────────────────────────────────────────────────┘    │
│                      │                                      │
│                      ▼                                      │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│                    MONGODB DATABASE                         │
│                                                             │
│  ┌───────────────────────────────────────────────────┐    │
│  │  users collection                                 │    │
│  │  {                                                │    │
│  │    email: "student@siu.edu.in"                    │    │
│  │    password: "$2a$10$hashed..."                   │    │
│  │    role: "student" or "admin"                     │    │
│  │    firstName: "John"                              │    │
│  │    lastName: "Doe"                                │    │
│  │  }                                                │    │
│  └───────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Login Flow (Step by Step)

```
1. USER enters email/password
   ↓
2. FRONTEND Login.tsx
   ↓ fetch(API_BASE_URL/api/users/login)
   ↓
3. BACKEND userController.loginUser()
   ↓
4. Check MONGODB for user
   ↓
5. If found: bcrypt.compare(password, hashedPassword)
   ↓
6. If match: Generate JWT token
   ↓
7. BACKEND sends back:
   {
     success: true,
     data: {
       _id, firstName, lastName, email, role,
       token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
     }
   }
   ↓
8. FRONTEND Login.tsx receives response
   ↓
9. Calls AuthContext.login(userData, token)
   ↓
10. AuthContext saves to:
    - State (user, token)
    - localStorage (for persistence)
   ↓
11. Navigate to /dashboard or /admin
   ↓
12. DONE! User is logged in
```

## Protected Route Flow

```
User tries to access /admin
   ↓
ProtectedRoute component checks:
   ↓
   ├─ Is loading? → Show spinner
   ├─ Not authenticated? → Redirect to /login
   ├─ Needs admin but not admin? → Redirect to /dashboard
   └─ All good? → Show AdminDashboard
```

## API Request Flow (After Login)

```
1. Component needs data (e.g., AdminDashboard)
   ↓
2. Calls authenticatedFetch('/admin/dashboard')
   ↓
3. api-config.ts automatically:
   - Gets token from localStorage
   - Adds to headers: Authorization: Bearer <token>
   ↓
4. BACKEND receives request
   ↓
5. Auth middleware checks token:
   - Valid? → Continue
   - Invalid? → Return 401 error
   ↓
6. Controller processes request
   ↓
7. Query MONGODB
   ↓
8. Send response back to FRONTEND
   ↓
9. Component updates UI with data
```

## Page Refresh Flow

```
1. User refreshes page
   ↓
2. AuthContext.useEffect() runs
   ↓
3. Checks localStorage:
   - token exists?
   - user data exists?
   ↓
4. If YES:
   - Parse user data
   - Set to state
   - User stays logged in ✅
   ↓
5. If NO:
   - Stay logged out
   - Redirect to /login if on protected page
```

## Key Files & Their Jobs

| File | What It Does |
|------|-------------|
| `AuthContext.tsx` | Global state for login/logout |
| `ProtectedRoute.tsx` | Guards routes from unauthorized access |
| `Login.tsx` | Login/Register forms, sends credentials to backend |
| `navigation.tsx` | Shows Login or Logout based on auth state |
| `api-config.ts` | Centralized API calls with auto JWT token |
| `App.tsx` | Main routing, wraps everything with AuthProvider |
| `userController.js` | Backend login/register logic |
| `auth.js` (middleware) | Backend JWT verification |

## Data Storage

### localStorage (Browser)
```javascript
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": "{\"_id\":\"...\",\"email\":\"...\",\"role\":\"student\"}"
}
```

### MongoDB (Database)
```javascript
{
  _id: ObjectId("..."),
  firstName: "John",
  lastName: "Doe",
  email: "john@student.siu.edu.in",
  password: "$2a$10$hashed...",  // Never plain text!
  prn: "23070122261",
  role: "student",  // or "admin"
  createdAt: ISODate("2024-01-01T00:00:00Z")
}
```

## Security Layers

1. **Password Hashing** (bcrypt)
   - Never store plain passwords
   - Hash in backend before saving
   - Compare hash during login

2. **JWT Tokens**
   - Signed with secret key
   - Contains user ID
   - Expires after 30 days
   - Backend verifies on each request

3. **Route Protection**
   - Frontend: ProtectedRoute component
   - Backend: Auth middleware
   - Both check authentication

4. **Role-Based Access**
   - User role stored in database
   - Checked on frontend (ProtectedRoute)
   - Checked on backend (admin routes)

## Why This Works

✅ **Frontend knows who's logged in** - AuthContext
✅ **Pages are protected** - ProtectedRoute
✅ **Login survives refresh** - localStorage
✅ **Backend verifies every request** - JWT middleware
✅ **Passwords are safe** - bcrypt hashing
✅ **Roles separate access** - admin vs student
✅ **One place for API calls** - api-config.ts

This is a professional, production-ready authentication system! 🚀
