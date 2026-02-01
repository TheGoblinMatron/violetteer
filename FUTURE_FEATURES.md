# Violetteer - Future Features

This file tracks planned features and improvements for future development.

---

## 1. Flexible User Roles System

**Priority**: Medium
**Complexity**: Medium
**Current State**: Simple `isAdmin: boolean` flag on User model

### Goal

Replace the current `isAdmin` boolean with a flexible roles array to support multiple user types:
- `admin` - Full system access, can manage catalog
- `hybridizer` - Can submit new varieties, mark plants as their creations
- `commercial_grower` - Can list plants for sale, manage inventory
- `user` - Default role, can manage personal lists

### Implementation Approach

**Option: PostgreSQL Array Field** (Recommended)

```prisma
model User {
  // Remove: isAdmin Boolean @default(false)
  roles String[] @default([])  // e.g., ["hybridizer", "commercial_grower"]
}
```

### Changes Required

1. **Database Migration**
   - Add `roles String[]` field to User model
   - Migrate existing `isAdmin: true` users to `roles: ["admin"]`
   - Remove `isAdmin` field

2. **Better Auth Configuration** (`server/lib/auth.js`)
   ```javascript
   user: {
     additionalFields: {
       roles: {
         type: "string[]",
         defaultValue: [],
       },
     },
   },
   ```

3. **Auth Context** (`src/context/AuthContext.jsx`)
   ```javascript
   const value = {
     user: session?.user ?? null,
     roles: session?.user?.roles ?? [],
     hasRole: (role) => session?.user?.roles?.includes(role) ?? false,
     isAdmin: session?.user?.roles?.includes('admin') ?? false,
     // ... rest
   };
   ```

4. **Component Updates**
   - Replace `isAdmin` checks with `hasRole('admin')`
   - Add role-specific UI elements (e.g., hybridizer badge on plants they created)

5. **Backend Middleware** (`server/middleware/auth.js`)
   ```javascript
   export const requireRole = (role) => (req, res, next) => {
     if (!req.user?.roles?.includes(role)) {
       return res.status(403).json({ error: 'Insufficient permissions' });
     }
     next();
   };
   ```

### Future Role Ideas

| Role | Permissions |
|------|-------------|
| `admin` | Manage catalog, approve contributions, manage users |
| `hybridizer` | Submit new varieties, claim existing as their work |
| `commercial_grower` | List plants for sale, manage storefront |
| `moderator` | Review contributions, flag inappropriate content |
| `verified_collector` | Badge on profile, early access to features |

---

## 2. [Next Feature Title]

**Priority**: _TBD_
**Complexity**: _TBD_
**Current State**: _TBD_

### Goal

_Description of what this feature would accomplish_

### Implementation Approach

_High-level approach_

### Changes Required

_List of changes needed_

---
