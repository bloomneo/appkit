# AppKit CLI Documentation

## Overview

The AppKit CLI is a powerful command-line interface for creating production-ready TypeScript backend applications with Feature-Based Component Architecture (FBCA). It provides auto-discovery routing, complete authentication systems, secure environment configuration, database integration, and follows modern development best practices.

## Installation

```bash
npm install -g @bloomneo/appkit
```

## Quick Start

```bash
# Create a new app
appkit generate app myproject
cd myproject

# Add authentication system
appkit generate feature user

# Add custom features
appkit generate feature product
appkit generate feature order

# Start development
npm run dev:api
```

## Commands Overview

| Command | Description | When to Use | Security Features |
|---------|-------------|-------------|-------------------|
| `generate app [name]` | Create complete backend app | Starting new project | Random secure keys, GitHub-safe |
| `generate feature <name>` | Add custom CRUD feature | Need basic API endpoints | Follows security patterns |
| `generate feature user` | Add authentication system | Need user management/auth | JWT, role-based access, 9-role hierarchy |

## Commands Reference

### 🚀 `appkit generate app [name]`

Creates a complete TypeScript backend application with modern architecture.

**Usage:**
```bash
# Create in current directory
appkit generate app

# Create in new directory
appkit generate app myproject
```

**What it creates:**
```
myproject/
├── package.json           # Dependencies & scripts
├── tsconfig.json          # TypeScript configuration
├── .env                   # Secure environment variables
├── prisma/
│   └── schema.prisma      # Database schema
└── src/api/
    ├── server.ts          # Main server
    ├── lib/
    │   └── api-router.ts  # Auto-discovery router
    └── features/
        ├── welcome/       # Default welcome feature
        ├── sample/        # Example CRUD feature
        └── new/           # Example feature
```

**✨ Features:**
- ✅ **Secure by default** - Random 44-char auth secrets, 26-char API keys
- ✅ **GitHub-safe** - No hardcoded credentials
- ✅ **TypeScript ready** - Full type safety with proper configuration
- ✅ **Auto-discovery** - Routes automatically discovered and mounted
- ✅ **Production-ready** - Environment separation, logging, error handling
- ✅ **Database ready** - Prisma integration with SQLite default

**Generated .env file:**
```bash
DATABASE_URL="file:./dev.db"
VOILA_FRONTEND_KEY="voila_abc123..."      # 26 characters
VOILA_AUTH_SECRET="auth_xyz789..."        # 44 characters
DEFAULT_USER_PASSWORD="pwd9x7k4m2"       # 10 alphanumeric
```

### 🔧 `appkit generate feature <name>`

Creates a custom feature with complete CRUD operations.

**Usage:**
```bash
appkit generate feature product
appkit generate feature order
appkit generate feature blog
```

**What it creates:**
```
src/api/features/product/
├── product.route.ts     # Express routes with CRUD endpoints
├── product.service.ts   # Business logic with validation
├── product.types.ts     # TypeScript interfaces
├── product.model.ts     # Database model
└── product.http         # HTTP test file
```

**Generated endpoints:**
- `GET /api/product` - Get all records
- `POST /api/product` - Create new record
- `GET /api/product/:id` - Get record by ID
- `PUT /api/product/:id` - Update record
- `DELETE /api/product/:id` - Delete record

**When to use:**
- ✅ Need custom business logic
- ✅ Want specific data models
- ✅ Building domain-specific APIs
- ✅ Rapid prototyping

### 🔐 `appkit generate feature user`

Creates a complete authentication and user management system.

**Usage:**
```bash
appkit generate feature user
```

**What it creates:**
```
src/api/features/user/
├── user.route.ts        # Authentication routes
├── user.service.ts      # Auth business logic
├── user.types.ts        # User interfaces
├── user.model.ts        # User database model
└── user.http            # Complete test suite

prisma/seeding/
└── user.seed.js         # Seed data for all roles
```

**🔐 Authentication Features:**
- ✅ **JWT Authentication** - Secure token-based auth
- ✅ **9-Role Hierarchy** - user.basic → admin.system
- ✅ **Password Security** - bcrypt hashing, random generation
- ✅ **Role-based Access** - Route protection by role/level
- ✅ **Complete User Management** - CRUD for admin users
- ✅ **Password Reset** - Forgot/reset password flow
- ✅ **Account Management** - Profile updates, password changes

**Generated endpoints:**
```
# Authentication
POST /api/user/register      # Create new user
POST /api/user/login         # User login
POST /api/user/forgot-password  # Request password reset
POST /api/user/reset-password   # Reset with token

# Profile Management
GET  /api/user/profile       # Get user profile
PUT  /api/user/profile       # Update profile
POST /api/user/change-password  # Change password

# Admin Only
GET    /api/user/all         # Get all users
GET    /api/user/list        # Get users (moderator+)
PUT    /api/user/list/:id    # Update user
DELETE /api/user/list/:id    # Delete user
```

**🛡️ Role Hierarchy:**
```
User Roles (Level 1-3):
├── user.basic       # Basic user permissions
├── user.pro         # Pro user features
└── user.max         # Maximum user features

Moderator Roles (Level 4-6):
├── moderator.review   # Can review content
├── moderator.approve  # Can approve/reject
└── moderator.manage   # Can manage users

Admin Roles (Level 7-9):
├── admin.tenant     # Tenant administration
├── admin.org        # Organization administration
└── admin.system     # System administration
```

**When to use:**
- ✅ Need user accounts and authentication
- ✅ Building multi-user applications
- ✅ Need role-based access control
- ✅ Want production-ready auth system
- ✅ Building SaaS or enterprise apps

## Decision Guide

### When to use `generate app`
- 🎯 **Starting a new project**
- 🎯 **Need complete backend foundation**
- 🎯 **Want security best practices built-in**
- 🎯 **Building production applications**

### When to use `generate feature <name>`
- 🎯 **Adding business-specific functionality**
- 🎯 **Need custom data models**
- 🎯 **Building domain APIs (products, orders, etc.)**
- 🎯 **Rapid prototyping**

### When to use `generate feature user`
- 🎯 **Need user authentication**
- 🎯 **Building multi-user applications**
- 🎯 **Need role-based permissions**
- 🎯 **Want enterprise-grade user management**

## Architecture

### Feature-Based Component Architecture (FBCA)

Each feature is self-contained and follows consistent patterns:

```
src/api/features/<feature>/
├── <feature>.route.ts    # HTTP endpoints & middleware
├── <feature>.service.ts  # Business logic & validation
├── <feature>.types.ts    # TypeScript interfaces
├── <feature>.model.ts    # Database schema
└── <feature>.http        # API testing
```

### Auto-Discovery System

- 🔍 **Automatic route detection** - Scans `/features` directory
- 🚀 **Zero configuration** - Routes auto-mount at `/api/{feature}`
- 🔄 **Hot-reload friendly** - Changes reflected immediately
- 📋 **Discovery endpoint** - `GET /api` lists all features

### Security Architecture

**Environment Security:**
- 🔐 **Random key generation** - Unique per project
- 🚫 **No hardcoded secrets** - GitHub-safe repositories
- 🛡️ **Environment separation** - Dev/prod configurations
- 🔑 **Secure defaults** - Strong random passwords

**Authentication Security:**
- 🎫 **JWT tokens** - Stateless authentication
- 🔒 **Password hashing** - bcrypt with salt rounds
- 🛡️ **Role-based access** - Granular permissions
- 🔐 **Token validation** - Middleware protection

## Development Workflow

### 1. Project Setup
```bash
# Create project
appkit generate app myapp
cd myapp

# Install dependencies (auto-done)
npm install

# Start development
npm run dev:api
```

### 2. Add Authentication
```bash
# Add complete auth system
appkit generate feature user

# Seed test users
node prisma/seeding/user.seed.js

# Test login
curl -X POST http://localhost:3000/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin.system@myapp.com","password":"YOUR_DEFAULT_PASSWORD"}'
```

### 3. Add Custom Features
```bash
# Add business features
appkit generate feature product
appkit generate feature order
appkit generate feature customer
```

### 4. Test & Deploy
```bash
# Run tests
npm test

# Build for production
npm run build

# Start production
npm run start:prod
```

## Environment Configuration

### Auto-Generated .env
```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Database Configuration
DATABASE_URL="file:./dev.db"

# Application Configuration
APP_NAME=myapp
API_VERSION=1.0.0

# Security (Auto-generated, GitHub-safe)
VOILA_FRONTEND_KEY=voila_abc123def456...     # 26 chars
VOILA_AUTH_SECRET=auth_xyz789abc123...       # 44 chars
DEFAULT_USER_PASSWORD=pwd9x7k4m2             # 10 chars

# Logging
LOG_LEVEL=info
```

### Production Environment
```bash
# Override for production
NODE_ENV=production
PORT=8080
DATABASE_URL="postgresql://user:pass@host:5432/db"
LOG_LEVEL=warn
```

## Available Scripts

| Script | Description | When to Use |
|--------|-------------|-------------|
| `npm run dev:api` | Development server with hot-reload | During development |
| `npm run build` | Build TypeScript to JavaScript | Before deployment |
| `npm run start:prod` | Start production server | Production deployment |
| `npm run start` | Start without build | Quick production start |

## Testing

### HTTP Test Files

Each feature includes a `.http` file for easy testing:

```http
### Test login
POST http://localhost:3000/api/user/login
Content-Type: application/json

{
  "email": "admin.system@myapp.com",
  "password": "YOUR_DEFAULT_PASSWORD"
}

### Test protected endpoint
GET http://localhost:3000/api/user/profile
Authorization: Bearer YOUR_JWT_TOKEN
```

### Integration Testing

```bash
# Test endpoints with curl
curl http://localhost:3000/health
curl http://localhost:3000/api
curl http://localhost:3000/api/user/test
```

## AppKit Integration

### Database
```typescript
import { databaseClass } from '@bloomneo/appkit/database';

const db = await databaseClass.get();
const users = await db.user.findMany();
```

### Authentication
```typescript
import { authClass } from '@bloomneo/appkit/auth';

const auth = authClass.get();
const token = auth.generateLoginToken({ userId, role, level });
```

### Error Handling
```typescript
import { errorClass } from '@bloomneo/appkit/error';

const error = errorClass.get();
throw error.badRequest('Invalid input');
throw error.notFound('User not found');
```

### Logging
```typescript
import { loggerClass } from '@bloomneo/appkit/logger';

const logger = loggerClass.get('feature-name');
logger.info('Request processed', { userId });
```

## Best Practices

### Security
- ✅ **Use environment variables** for all secrets
- ✅ **Never commit .env files** to version control
- ✅ **Use role-based access control** for sensitive endpoints
- ✅ **Validate all inputs** in service layers
- ✅ **Use JWT tokens** for stateless authentication

### Code Organization
- ✅ **Follow FBCA patterns** - keep features self-contained
- ✅ **Use TypeScript interfaces** for type safety
- ✅ **Implement proper error handling** with AppKit error classes
- ✅ **Add comprehensive logging** for debugging
- ✅ **Write HTTP tests** for all endpoints

### Database
- ✅ **Use AppKit database class** for consistency
- ✅ **Include tenant_id fields** for multi-tenancy
- ✅ **Transform dates to ISO strings** in responses
- ✅ **Implement input validation** before database operations

## Troubleshooting

### Common Issues

**Feature not discovered:**
- ✅ Check file naming: `{feature}.route.ts`
- ✅ Ensure default export: `export default router`
- ✅ Verify directory structure: `features/{feature}/`

**Authentication errors:**
- ✅ Check `VOILA_AUTH_SECRET` in .env
- ✅ Verify password in seeding
- ✅ Test with correct user credentials

**Database connection issues:**
- ✅ Verify `DATABASE_URL` in .env
- ✅ Run `npx prisma generate`
- ✅ Run `npx prisma db push`

**TypeScript compilation errors:**
- ✅ Check import paths use `.js` extensions
- ✅ Verify `moduleResolution: "bundler"` in tsconfig
- ✅ Ensure proper AppKit module imports

## Examples

### Complete User Management Flow

```bash
# 1. Create app with auth
appkit generate app userapp
cd userapp
appkit generate feature user

# 2. Seed test users
node prisma/seeding/user.seed.js

# 3. Test authentication
curl -X POST http://localhost:3000/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin.system@userapp.com","password":"YOUR_DEFAULT_PASSWORD"}'

# 4. Use JWT token for protected endpoints
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/user/profile
```

### E-commerce API Example

```bash
# Create e-commerce backend
appkit generate app shopapi
cd shopapi

# Add authentication
appkit generate feature user

# Add business features
appkit generate feature product
appkit generate feature order
appkit generate feature customer
appkit generate feature category

# Result: Complete e-commerce API with auth
# GET  /api/user/*      - User management
# GET  /api/product/*   - Product catalog
# GET  /api/order/*     - Order management
# GET  /api/customer/*  - Customer data
# GET  /api/category/*  - Product categories
```

---

**AppKit CLI - Production-ready backend applications in minutes, not hours.** 🚀

**Generated with AppKit CLI v3.0 - Enhanced with Authentication, Security, and GitHub-safe Repositories**