# @bloomneo/appkit - Authentication Module 🔐

[![npm version](https://img.shields.io/npm/v/@bloomneo/appkit.svg)](https://www.npmjs.com/package/@bloomneo/appkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Ultra-simple authentication with JWT tokens, bcrypt passwords, and role-based permissions. Express-only middleware with clear separation between user authentication and API access.

**Two token types** for different authentication needs: Login tokens for users, API tokens for external services. Built-in role hierarchy and permission inheritance. Production-ready security.

## 🚀 Why Choose This?

- **⚡ Simple API** - Just `authClass.get()`, everything else is automatic
- **🔒 Two Token Types** - Login tokens for users, API tokens for services
- **🎯 Clear Separation** - No confusion between user auth and API auth
- **👥 Smart Role Hierarchy** - Built-in role.level inheritance (user.basic → admin.system)
- **🔧 Zero Configuration** - Smart defaults for everything
- **🛡️ Null-Safe Access** - Safe user extraction with `auth.user(req)`
- **🤖 AI-Ready** - Optimized for LLM code generation with clear method names

## 📦 Installation

```bash
npm install @bloomneo/appkit
```

## 🏃‍♂️ Quick Start (30 seconds)

**⚠️ AUTH_SECRET Required**: You must generate a secure secret for JWT tokens.

```bash
# Generate and set your JWT secret (required for startup)
echo "VOILA_AUTH_SECRET=your-super-secure-jwt-secret-key-2024-minimum-32-chars" > .env
```

```typescript
import { authClass } from '@bloomneo/appkit/auth';

const auth = authClass.get();

// User authentication (login tokens)
const loginToken = auth.generateLoginToken({ 
  userId: 123, 
  role: 'user', 
  level: 'basic' 
});

// API authentication (API tokens)
const apiToken = auth.generateApiToken({ 
  keyId: 'webhook_service', 
  role: 'api', 
  level: 'external' 
});

// Express middleware protection
app.get('/user/profile', auth.requireLoginToken(), handler);
app.post('/api/webhook', auth.requireApiToken(), handler);
app.get('/admin', auth.requireLoginToken(), auth.requireUserRoles(['admin.tenant']), handler);
```

## 🎯 Two Token Types - Crystal Clear

### **Login Tokens (User Authentication)**
For humans logging into your app (mobile/web):

```typescript
// Generate login token
const loginToken = auth.generateLoginToken({
  userId: 123,
  role: 'user',
  level: 'basic'
}, '7d'); // Short-medium expiry

// Protect user routes
app.get('/profile', auth.requireLoginToken(), handler);
app.get('/admin', 
  auth.requireLoginToken(), 
  auth.requireUserRoles(['admin.tenant']), 
  handler
);
```

### **API Tokens (External Access)**
For third-party services, webhooks, and integrations:

```typescript
// Generate API token  
const apiToken = auth.generateApiToken({
  keyId: 'webhook_payment_service',
  role: 'service',
  level: 'webhook'
}, '1y'); // Long expiry

// Protect API routes (no user roles/permissions)
app.post('/webhook/payment', auth.requireApiToken(), handler);
app.get('/api/public-data', auth.requireApiToken(), handler);
```

## 🏗️ Role-Level-Permission Architecture

**Built-in Role Hierarchy (9 levels):**

```typescript
'user.basic'        // Level 1 - Basic user
'user.pro'         // Level 2 - Premium user  
'user.max'         // Level 3 - Max user
'moderator.review' // Level 4 - Can review content
'moderator.approve'// Level 5 - Can approve content
'moderator.manage' // Level 6 - Can manage content
'admin.tenant'     // Level 7 - Tenant admin
'admin.org'        // Level 8 - Organization admin
'admin.system'     // Level 9 - System admin
```

**Permission System:**
- **Actions**: `view`, `create`, `edit`, `delete`, `manage`
- **Scopes**: `own`, `tenant`, `org`, `system`
- **Format**: `action:scope` (e.g., `manage:tenant`)

**Inheritance Examples:**
```typescript
// ✅ These return TRUE (higher includes lower)
auth.hasRole('admin.org', 'admin.tenant'); // org > tenant
auth.hasRole('admin.system', 'user.basic'); // system > basic

// ❌ These return FALSE (lower cannot access higher)
auth.hasRole('user.basic', 'admin.tenant'); // basic < tenant
```

## 🛡️ Express Middleware Patterns

### **User Authentication Flow**
```typescript
// Step 1: Authenticate user
app.get('/user/dashboard', auth.requireLoginToken(), (req, res) => {
  const user = auth.user(req); // Safe access, never null here
  res.json({ userId: user.userId, role: user.role });
});

// Step 2: Require specific roles (user needs ANY of these)
app.get('/admin/panel', 
  auth.requireLoginToken(),
  auth.requireUserRoles(['admin.tenant', 'admin.org']),
  handler
);

// Step 3: Require specific permissions (user needs ALL of these)
app.post('/admin/users', 
  auth.requireLoginToken(),
  auth.requireUserPermissions(['manage:users', 'edit:tenant']),
  handler
);
```

### **API Access Flow**
```typescript
// Simple API protection (no roles/permissions)
app.post('/api/webhook', auth.requireApiToken(), (req, res) => {
  const token = auth.user(req); // Gets API token info
  console.log('API call from:', token.keyId);
  res.json({ status: 'received' });
});
```

## 🤖 LLM Quick Reference - Copy These Patterns

### **Token Generation (Copy Exactly)**

```typescript
// ✅ CORRECT - Login tokens for users
const loginToken = auth.generateLoginToken({
  userId: 123,           // Required: user identifier
  role: 'user',         // Required: role name
  level: 'basic',       // Required: level within role
  permissions: ['manage:own']  // Optional: custom permissions
}, '7d');

// ✅ CORRECT - API tokens for services
const apiToken = auth.generateApiToken({
  keyId: 'webhook_service',  // Required: service identifier
  role: 'api',              // Required: role name  
  level: 'external',        // Required: level within role
  permissions: ['webhook:receive']  // Optional: custom permissions
}, '1y');

// ❌ WRONG - Don't mix these up
auth.generateLoginToken({ keyId: 'test' }); // keyId is for API tokens
auth.generateApiToken({ userId: 123 });    // userId is for login tokens
```

### **Middleware Patterns (Copy These)**

```typescript
// ✅ CORRECT - User routes with roles
app.get('/admin/users', 
  auth.requireLoginToken(),                    // Authenticate user
  auth.requireUserRoles(['admin.tenant']),     // Check user role
  handler
);

// ✅ CORRECT - API routes (no roles)
app.post('/webhook/data', 
  auth.requireApiToken(),  // Authenticate API token only
  handler
);

// ❌ WRONG - Don't use user roles with API tokens
app.post('/webhook', 
  auth.requireApiToken(),
  auth.requireUserRoles(['admin']),  // ERROR: API tokens don't have user roles
  handler
);
```

## ⚠️ Common LLM Mistakes - Avoid These

### **Token Type Confusion**

```typescript
// ❌ Using wrong token type for wrong purpose
const userToken = auth.generateApiToken({ userId: 123 }); // Wrong: use generateLoginToken
const apiToken = auth.generateLoginToken({ keyId: 'api' }); // Wrong: use generateApiToken

// ✅ Use correct token type for purpose
const userToken = auth.generateLoginToken({ userId: 123, role: 'user', level: 'basic' });
const apiToken = auth.generateApiToken({ keyId: 'api_key', role: 'service', level: 'external' });
```

### **Middleware Errors**

```typescript
// ❌ Trying to use user roles with API tokens
app.post('/api/data', 
  auth.requireApiToken(),
  auth.requireUserRoles(['admin']), // ERROR: API tokens don't have user roles
  handler
);

// ✅ Keep API routes simple
app.post('/api/data', auth.requireApiToken(), handler);

// ✅ Use user roles only with login tokens
app.get('/admin', 
  auth.requireLoginToken(),
  auth.requireUserRoles(['admin.tenant']),
  handler
);
```

### **Role Array Format**

```typescript
// ❌ Wrong parameter types
auth.requireUserRoles('admin.tenant'); // String - should be array
auth.requireUserRoles(['admin', 'tenant']); // Wrong format - should be role.level

// ✅ Correct array format
auth.requireUserRoles(['admin.tenant']);
auth.requireUserRoles(['admin.tenant', 'admin.org']); // Multiple roles (OR logic)
auth.requireUserPermissions(['manage:users', 'edit:tenant']); // Multiple permissions (AND logic)
```

## 🚨 Error Handling Patterns

### **Token Operations**

```typescript
try {
  const loginToken = auth.generateLoginToken({ userId, role, level });
  return { token: loginToken };
} catch (error) {
  // Invalid role.level, missing fields, etc.
  return res.status(500).json({ error: 'Token creation failed' });
}

try {
  const payload = auth.verifyToken(token);
  // Use payload...
} catch (error) {
  if (error.message === 'Token has expired') {
    return res.status(401).json({ error: 'Session expired' });
  }
  return res.status(401).json({ error: 'Invalid token' });
}
```

### **Middleware Error Handling**

```typescript
// Errors are handled automatically by middleware
app.get('/admin', 
  auth.requireLoginToken(),        // 401 if no/invalid token
  auth.requireUserRoles(['admin.tenant']), // 403 if insufficient role
  (req, res) => {
    // This only runs if all auth succeeds
    const user = auth.user(req); // Safe - never null here
    res.json({ message: 'Welcome admin!' });
  }
);
```

## 🚀 Production Deployment Checklist

### **Environment Setup**

```bash
# ✅ Required - Strong secret (32+ characters)
VOILA_AUTH_SECRET=your-cryptographically-secure-secret-key-here

# ✅ Recommended - Shorter expiry for security
VOILA_AUTH_EXPIRES_IN=2h

# ✅ Performance - Higher rounds for better security
VOILA_AUTH_BCRYPT_ROUNDS=12

# ✅ Optional - Custom role hierarchy
VOILA_AUTH_ROLES=user.basic:1,user.premium:2,admin.super:10

# ✅ Optional - Custom permissions  
VOILA_AUTH_PERMISSIONS=user.premium:manage:own,admin.super:manage:system
```

### **Security Validation**

```typescript
// App startup validation
try {
  const auth = authClass.get();
  console.log('✅ Auth initialized successfully');
} catch (error) {
  console.error('❌ Auth setup failed:', error.message);
  process.exit(1);
}
```

## 📖 Essential Usage Patterns

### **Complete Authentication Flow**

```typescript
// Registration
app.post('/register', async (req, res) => {
  const { email, password } = req.body;
  
  // Hash password
  const hashedPassword = await auth.hashPassword(password);
  
  // Save user to database
  const user = await User.create({ email, password: hashedPassword });
  
  // Generate login token
  const token = auth.generateLoginToken({
    userId: user.id,
    role: 'user',
    level: 'basic'
  });
  
  res.json({ token, user: { id: user.id, email } });
});

// Login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  const user = await User.findOne({ email });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  
  const isValid = await auth.comparePassword(password, user.password);
  if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });
  
  const token = auth.generateLoginToken({
    userId: user.id,
    role: user.role,
    level: user.level
  });
  
  res.json({ token });
});
```

### **API Token Management**

```typescript
// Create API token for external service
app.post('/admin/api-tokens', 
  auth.requireLoginToken(),
  auth.requireUserRoles(['admin.tenant']),
  async (req, res) => {
    const { name, permissions } = req.body;
    
    const apiToken = auth.generateApiToken({
      keyId: `api_${Date.now()}`,
      role: 'service', 
      level: 'external',
      permissions
    }, '1y');
    
    // Store token info in database (store hash, not plain token)
    const hashedToken = await auth.hashPassword(apiToken);
    await ApiToken.create({ name, token: hashedToken });
    
    // Return token once (client should save it)
    res.json({ apiToken });
  }
);
```

## 🌍 Environment Variables

```bash
# Required
VOILA_AUTH_SECRET=your-super-secure-jwt-secret-key-2024-minimum-32-chars

# Optional
VOILA_AUTH_BCRYPT_ROUNDS=12        # Default: 10
VOILA_AUTH_EXPIRES_IN=1h           # Default: 7d
VOILA_AUTH_DEFAULT_ROLE=user       # Default: user
VOILA_AUTH_DEFAULT_LEVEL=basic     # Default: basic

# Custom role hierarchy (optional)
VOILA_AUTH_ROLES=user.basic:1,user.pro:2,admin.system:9

# Custom permissions (optional)
VOILA_AUTH_PERMISSIONS=user.basic:view:own,admin.tenant:manage:tenant
```

## 📖 API Reference

### **Core Function**

```typescript
const auth = authClass.get(); // One function, all methods
```

### **Token Generation**

```typescript
auth.generateLoginToken({ userId, role, level, permissions }, expiresIn); // Create login JWT
auth.generateApiToken({ keyId, role, level, permissions }, expiresIn);    // Create API JWT
auth.verifyToken(token); // Verify any JWT token
```

### **Password Security**

```typescript
auth.hashPassword(password, rounds); // Hash password with bcrypt
auth.comparePassword(password, hash); // Verify password
```

### **User Access**

```typescript
auth.user(req); // Safe user extraction (returns null if not authenticated)
```

### **Authorization**

```typescript
auth.hasRole(userRole, requiredRole); // Check role hierarchy
auth.can(user, permission); // Check permission
```

### **Express Middleware**

```typescript
auth.requireLoginToken(options); // Login token authentication
auth.requireApiToken(options);   // API token authentication
auth.requireUserRoles(roles);    // User role authorization (array of strings)
auth.requireUserPermissions(permissions); // User permission authorization (array of strings)
```

### **Utility Methods**

```typescript
authClass.getRoles(); // Get role hierarchy
authClass.getPermissions(); // Get permission config
authClass.getAllRoles(); // Get all roles sorted by level
authClass.isValidRole(roleLevel); // Validate role format
authClass.reset(newConfig); // Reset instance (testing only)
```

## 🔧 Custom Role Examples

### **E-commerce Platform**

```bash
VOILA_AUTH_ROLES=customer.basic:1,customer.premium:2,vendor.starter:3,vendor.pro:4,staff.support:5,admin.store:6

VOILA_AUTH_PERMISSIONS=customer.basic:view:own,customer.premium:manage:own,vendor.starter:manage:products,admin.store:manage:store
```

### **Healthcare System**

```bash
VOILA_AUTH_ROLES=patient.basic:1,nurse.junior:2,nurse.senior:3,doctor.resident:4,doctor.attending:5,admin.clinic:6

VOILA_AUTH_PERMISSIONS=patient.basic:view:own,nurse.junior:view:patient,doctor.resident:manage:patient,admin.clinic:manage:clinic
```

## 🧪 Testing

```typescript
// Reset for clean testing
const auth = authClass.reset({
  jwt: { secret: 'test-secret-32-characters-long-for-security' },
  roles: {
    'test.user': { level: 1, inherits: [] },
    'test.admin': { level: 2, inherits: ['test.user'] },
  },
});

// Test login token
const loginToken = auth.generateLoginToken({
  userId: 123,
  role: 'test',
  level: 'user'
});

// Test API token  
const apiToken = auth.generateApiToken({
  keyId: 'test_api',
  role: 'test', 
  level: 'admin'
});

// Test middleware
const req = { headers: { authorization: `Bearer ${loginToken}` } };
const middleware = auth.requireLoginToken();
// Test with mock req/res objects
```

## 📈 Performance

- **JWT Operations**: ~1ms per token
- **Password Hashing**: ~100ms (10 rounds)
- **Permission Checking**: ~0.1ms per check
- **Memory Usage**: <1MB overhead
- **Environment Parsing**: Once per app startup

## 🔍 TypeScript Support

```typescript
import type {
  JwtPayload,
  LoginTokenPayload,
  ApiTokenPayload,
  AuthConfig,
  RoleHierarchy,
  ExpressRequest,
  ExpressResponse,
  ExpressMiddleware,
} from '@bloomneo/appkit/auth';

// All methods are fully typed
const user: JwtPayload | null = auth.user(req);
const middleware: ExpressMiddleware = auth.requireUserRoles(['admin.tenant']);
```

## ❓ FAQ

**Q: Can I use both login and API tokens in the same app?**
A: Yes! Use login tokens for user authentication and API tokens for external services.

**Q: Can API tokens have user roles?**
A: No, API tokens represent services, not users. Use `requireUserRoles()` only with login tokens.

**Q: How do I handle token expiration?**
A: The middleware automatically returns 401 with "Token has expired" message. Handle this in your frontend.

**Q: Can I customize the role hierarchy?**
A: Yes, use environment variables or pass custom config to `authClass.get()`.

**Q: What's the difference between roles and permissions?**
A: Roles are hierarchical (admin.org > admin.tenant), permissions are specific actions (edit:tenant).

## 📄 License

MIT © [Bloomneo](https://github.com/bloomneo)

---

<p align="center">
  Built with ❤️ in India by the <a href="https://github.com/orgs/bloomneo/people">Bloomneo Team</a>
</p>