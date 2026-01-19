# Domain Monitor - System Workflow Documentation

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Authentication Flow](#2-authentication-flow)
3. [Domain Management Flow](#3-domain-management-flow)
4. [Provider Integration Flow](#4-provider-integration-flow)
5. [Role-Based Access Control (RBAC)](#5-role-based-access-control-rbac)
6. [API Request Lifecycle](#6-api-request-lifecycle)
7. [Data Flow Diagrams](#7-data-flow-diagrams)

---

## 1. Architecture Overview

### 1.1 System Layers

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT (API Consumer)                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    NGINX (Reverse Proxy)                     │
│                    - SSL Termination                         │
│                    - Rate Limiting                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    EXPRESS.JS APPLICATION                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Routes  │→ │Controller│→ │ Service  │→ │Repository│    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│       │              │             │              │          │
│       ▼              ▼             ▼              ▼          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │Middleware│  │Validator │  │ Provider │  │    DB    │    │
│  │  (Auth)  │  │  (Joi)   │  │ Service  │  │  (MySQL) │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   EXTERNAL PROVIDERS                         │
│              (TrueBiz, Future Providers)                     │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Directory Structure

```
src/
├── app.js              # Express app setup, middleware
├── server.js           # HTTP server, graceful shutdown
├── config/
│   └── database.js     # MySQL connection pool
├── routes/
│   ├── index.js        # Route aggregator
│   ├── auth.js         # Authentication routes
│   ├── users.js        # User profile routes
│   ├── domains.js      # Domain management routes
│   └── providers.js    # Admin provider routes
├── controllers/        # Request handlers (thin layer)
├── services/           # Business logic
│   ├── domainService.js
│   ├── providerService.js
│   ├── providerAdminService.js
│   └── providers/
│       ├── BaseProvider.js
│       └── TrueBizProvider.js
├── repositories/       # Database queries (raw SQL)
├── middlewares/
│   ├── auth.js         # JWT authentication, RBAC
│   ├── validate.js     # Request validation
│   └── errorHandler.js # Global error handling
├── validators/         # Joi schemas
└── utils/
    ├── logger.js       # Pino structured logging
    ├── encryption.js   # AES-256-GCM for API keys
    └── AppError.js     # Custom error class
```

---

## 2. Authentication Flow

### 2.1 User Registration

```
Client                    Server                      Database
  │                         │                            │
  │  POST /auth/register    │                            │
  │  {email, password,name} │                            │
  │────────────────────────>│                            │
  │                         │                            │
  │                         │  Validate input (Joi)      │
  │                         │  Hash password (bcrypt)    │
  │                         │                            │
  │                         │  INSERT INTO users         │
  │                         │───────────────────────────>│
  │                         │                            │
  │                         │        User created        │
  │                         │<───────────────────────────│
  │                         │                            │
  │    201 {userId, email}  │                            │
  │<────────────────────────│                            │
```

### 2.2 User Login & Token Generation

```
Client                    Server                      Database
  │                         │                            │
  │  POST /auth/login       │                            │
  │  {email, password}      │                            │
  │────────────────────────>│                            │
  │                         │                            │
  │                         │  SELECT user by email      │
  │                         │───────────────────────────>│
  │                         │                            │
  │                         │        User data           │
  │                         │<───────────────────────────│
  │                         │                            │
  │                         │  Verify password (bcrypt)  │
  │                         │  Generate JWT (15min)      │
  │                         │  Generate refresh token    │
  │                         │                            │
  │                         │  Store refresh token hash  │
  │                         │───────────────────────────>│
  │                         │                            │
  │  200 {accessToken,      │                            │
  │       refreshToken,     │                            │
  │       expiresIn: 900}   │                            │
  │<────────────────────────│                            │
```

### 2.3 Token Refresh Flow

```
Client                    Server                      Database
  │                         │                            │
  │  POST /auth/refresh     │                            │
  │  {refreshToken}         │                            │
  │────────────────────────>│                            │
  │                         │                            │
  │                         │  Validate refresh token    │
  │                         │  hash against DB           │
  │                         │───────────────────────────>│
  │                         │                            │
  │                         │  Generate new tokens       │
  │                         │  Invalidate old refresh    │
  │                         │───────────────────────────>│
  │                         │                            │
  │  200 {accessToken,      │                            │
  │       refreshToken}     │                            │
  │<────────────────────────│                            │
```

### 2.4 JWT Token Structure

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "userId": "uuid",
    "email": "user@example.com",
    "role": "merchant|reseller|superadmin",
    "iat": 1234567890,
    "exp": 1234568790
  }
}
```

---

## 3. Domain Management Flow

### 3.1 Add Single Domain

```
Client                    Server                   Provider API         Database
  │                         │                           │                  │
  │ POST /domains           │                           │                  │
  │ {domain, checkFrequency}│                           │                  │
  │────────────────────────>│                           │                  │
  │                         │                           │                  │
  │                         │  Validate domain format   │                  │
  │                         │  Check for duplicates     │                  │
  │                         │──────────────────────────────────────────────>│
  │                         │                           │                  │
  │                         │  INSERT domain record     │                  │
  │                         │──────────────────────────────────────────────>│
  │                         │                           │                  │
  │                         │  Trigger provider check   │                  │
  │                         │  (async, non-blocking)    │                  │
  │                         │─────────────────────────->│                  │
  │                         │                           │                  │
  │  201 {domain data}      │                           │                  │
  │<────────────────────────│                           │                  │
  │                         │                           │                  │
  │                         │   Provider response       │                  │
  │                         │<─────────────────────────│                  │
  │                         │                           │                  │
  │                         │   Update domain record    │                  │
  │                         │──────────────────────────────────────────────>│
  │                         │                           │                  │
  │                         │   Log API call            │                  │
  │                         │──────────────────────────────────────────────>│
```

### 3.2 Bulk Domain Creation

```
Client                    Server                   Provider API         Database
  │                         │                           │                  │
  │ POST /domains/bulk      │                           │                  │
  │ {domains: [{...}]}      │                           │                  │
  │────────────────────────>│                           │                  │
  │                         │                           │                  │
  │                         │  For each domain:         │                  │
  │                         │  ├─ Validate              │                  │
  │                         │  ├─ Check duplicate       │                  │
  │                         │  └─ Insert if valid       │                  │
  │                         │──────────────────────────────────────────────>│
  │                         │                           │                  │
  │                         │  For each created domain: │                  │
  │                         │  ├─ Call provider API     │                  │
  │                         │  │──────────────────────->│                  │
  │                         │  │                        │                  │
  │                         │  │<──────────────────────│                  │
  │                         │  │                        │                  │
  │                         │  ├─ Update domain         │                  │
  │                         │  │─────────────────────────────────────────>│
  │                         │  │                        │                  │
  │                         │  └─ Log API call          │                  │
  │                         │  │─────────────────────────────────────────>│
  │                         │                           │                  │
  │  201 {                  │                           │                  │
  │    success: [...],      │                           │                  │
  │    failed: [...],       │                           │                  │
  │    providerChecks: {    │                           │                  │
  │      checked: n,        │                           │                  │
  │      failed: m          │                           │                  │
  │    }                    │                           │                  │
  │  }                      │                           │                  │
  │<────────────────────────│                           │                  │
```

### 3.3 Domain Status Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                     DOMAIN STATUS                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│    ┌──────────┐     PATCH /stop     ┌──────────┐            │
│    │  ACTIVE  │ ──────────────────> │ INACTIVE │            │
│    │          │ <────────────────── │          │            │
│    └──────────┘     PATCH /start    └──────────┘            │
│         │                                                    │
│         │ Scheduled checks run                               │
│         │ when status = active                               │
│         ▼                                                    │
│    ┌──────────────────────────────────────────┐             │
│    │           RECOMMENDATION                 │             │
│    │  ┌──────┐  ┌──────┐  ┌────────┐         │             │
│    │  │ PASS │  │ FAIL │  │ REVIEW │  │ NULL │             │
│    │  └──────┘  └──────┘  └────────┘  └──────┘             │
│    │  (verified) (rejected) (manual)  (pending)            │
│    └──────────────────────────────────────────┘             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Provider Integration Flow

### 4.1 Provider Initialization (Application Startup)

```
Application Start
       │
       ▼
┌─────────────────────────────────────┐
│  providerService.initialize()       │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Load enabled providers from DB     │
│  SELECT * FROM providers            │
│  WHERE enabled = TRUE               │
│  ORDER BY priority ASC              │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  For each provider:                 │
│  ├─ Decrypt API key                 │
│  ├─ Create provider instance        │
│  │   (e.g., TrueBizProvider)        │
│  ├─ Register in providers Map       │
│  └─ Set primary if priority = 10    │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Service Ready                      │
│  Primary: truebiz (priority 10)     │
│  Fallback: provider_b (priority 20) │
└─────────────────────────────────────┘
```

### 4.2 Provider Selection & Fallback (Current Implementation)

```
Domain Check Request
       │
       ▼
┌─────────────────────────────────────┐
│  Get Primary Provider               │
│  (lowest priority number)           │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Call provider.checkDomain()        │
└─────────────────────────────────────┘
       │
       ├── Success ──────────────────────> Return result
       │
       └── Failure ──────────────────────> Throw error
                                           (TODO: Try next provider)
```

### 4.3 Provider API Call Workflow

```
TrueBizProvider.checkDomain(domain, domainId)
       │
       ▼
┌─────────────────────────────────────┐
│  1. Log request (console + DB)      │
│     - timestamp                     │
│     - payload: {domain}             │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  2. Make HTTP POST request          │
│     POST /check-domain              │
│     Authorization: Bearer <key>     │
│     Body: {domain: "example.com"}   │
└─────────────────────────────────────┘
       │
       ├── Success (2xx)
       │       │
       │       ▼
       │  ┌─────────────────────────────────────┐
       │  │  3a. Log response (console + DB)    │
       │  │      - status code                  │
       │  │      - response data                │
       │  │      - duration                     │
       │  └─────────────────────────────────────┘
       │       │
       │       ▼
       │  ┌─────────────────────────────────────┐
       │  │  4. Standardize response            │
       │  │     Map provider fields to internal │
       │  │     schema (recommendation, name,   │
       │  │     industry, etc.)                 │
       │  └─────────────────────────────────────┘
       │       │
       │       ▼
       │  ┌─────────────────────────────────────┐
       │  │  5. Update domain record            │
       │  │     - recommendation                │
       │  │     - raw_data                      │
       │  │     - last_checked_at               │
       │  │     - next_check_at                 │
       │  └─────────────────────────────────────┘
       │       │
       │       ▼
       │  ┌─────────────────────────────────────┐
       │  │  6. Create check history record     │
       │  └─────────────────────────────────────┘
       │
       └── Failure (4xx/5xx/timeout)
               │
               ▼
          ┌─────────────────────────────────────┐
          │  3b. Log error (console + DB)       │
          │      - error message                │
          │      - response status (if any)     │
          │      - response data (if any)       │
          └─────────────────────────────────────┘
               │
               ▼
          ┌─────────────────────────────────────┐
          │  Throw processed error              │
          └─────────────────────────────────────┘
```

### 4.4 Provider Priority System

| Priority | Role | Behavior |
|----------|------|----------|
| 10 | Primary | Used for all domain checks |
| 20 | Secondary | Fallback when primary fails (TODO) |
| 30+ | Tertiary | Additional fallbacks (TODO) |

**Current State:** Only primary provider is used. Fallback is not yet implemented.

---

## 5. Role-Based Access Control (RBAC)

### 5.1 User Roles

```
┌─────────────────────────────────────────────────────────────┐
│                       USER ROLES                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐                                            │
│  │ SUPERADMIN  │  Full system access                        │
│  │             │  - Manage all domains                      │
│  │             │  - Add domains for any merchant            │
│  │             │  - Manage providers                        │
│  │             │  - View all data                           │
│  └─────────────┘                                            │
│         │                                                    │
│         │ can manage                                         │
│         ▼                                                    │
│  ┌─────────────┐                                            │
│  │  RESELLER   │  Limited write + read access               │
│  │             │  - Add domains for assigned merchants      │
│  │             │  - View merchant domains                   │
│  │             │  - Cannot manage providers                 │
│  └─────────────┘                                            │
│         │                                                    │
│         │ assigned to (N:M relationship)                     │
│         ▼                                                    │
│  ┌─────────────┐                                            │
│  │  MERCHANT   │  Read-only access to own domains           │
│  │             │  - View own domains only                   │
│  │             │  - Cannot add/modify domains               │
│  └─────────────┘                                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Permission Matrix

| Action | Superadmin | Reseller | Merchant |
|--------|------------|----------|----------|
| List all domains | Yes | Assigned merchants only | Own only |
| View domain details | Yes | Assigned merchants only | Own only |
| Create domain (own) | Yes | Yes | No |
| Create domain (for merchant) | Yes (any) | Yes (assigned) | No |
| Update domain | Yes | No | No |
| Delete domain | Yes | No | No |
| Manage providers | Yes | No | No |
| View provider API logs | Yes | No | No |

### 5.3 Adding Domains for Merchants

Superadmins and resellers can add domains on behalf of merchants using the `merchantId` parameter:

```
POST /api/v1/domains
{
  "domain": "example.com",
  "checkFrequency": "daily",
  "merchantId": "uuid-of-merchant"  // Optional: for superadmin/reseller
}
```

```
POST /api/v1/domains/bulk
{
  "domains": [{"domain": "example1.com"}, {"domain": "example2.com"}],
  "merchantId": "uuid-of-merchant"  // Optional: for superadmin/reseller
}
```

**Authorization Logic:**
- If `merchantId` is provided and caller is superadmin/reseller: domain added to merchant's account
- If `merchantId` is not provided: domain added to caller's own account
- Merchants cannot use `merchantId` parameter (ignored if provided)

### 5.4 Reseller-Merchant Relationship

```
┌─────────────────────────────────────────────────────────────┐
│            RESELLER-MERCHANT RELATIONSHIPS                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  reseller_merchant_relationships table:                      │
│  ┌──────────────┬──────────────┬─────────────┐              │
│  │ reseller_id  │ merchant_id  │ created_at  │              │
│  ├──────────────┼──────────────┼─────────────┤              │
│  │ reseller-001 │ merchant-001 │ 2026-01-15  │              │
│  │ reseller-001 │ merchant-002 │ 2026-01-15  │              │
│  │ reseller-002 │ merchant-003 │ 2026-01-16  │              │
│  └──────────────┴──────────────┴─────────────┘              │
│                                                              │
│  Query for reseller domains:                                 │
│  SELECT d.* FROM domains d                                   │
│  INNER JOIN reseller_merchant_relationships rmr              │
│    ON d.user_id = rmr.merchant_id                           │
│  WHERE rmr.reseller_id = ?                                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.5 Access Control Flow

```
API Request with JWT
       │
       ▼
┌─────────────────────────────────────┐
│  authenticate() middleware          │
│  - Verify JWT signature             │
│  - Decode user info                 │
│  - Attach user to req.user          │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Role-based middleware              │
│  - requireSuperadmin()              │
│  - requireReadOnly()                │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│  Service layer role check           │
│  if (isSuperadmin(user)) {          │
│    // access all                    │
│  } else if (isReseller(user)) {     │
│    // access assigned merchants     │
│  } else {                           │
│    // access own only               │
│  }                                  │
└─────────────────────────────────────┘
```

---

## 6. API Request Lifecycle

### 6.1 Complete Request Flow

```
HTTP Request
     │
     ▼
┌─────────────────────────────────────┐
│  1. Express receives request        │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│  2. Global Middleware               │
│  - helmet (security headers)        │
│  - cors                             │
│  - express.json (body parsing)      │
│  - requestId (correlation)          │
│  - requestLogger                    │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│  3. Route Matching                  │
│  /api/v1/domains → domains router   │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│  4. Route-level Middleware          │
│  - authenticate (JWT validation)    │
│  - validate (Joi schema)            │
│  - requireSuperadmin (if needed)    │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│  5. Controller                      │
│  - Extract params/body              │
│  - Call service                     │
│  - Format response                  │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│  6. Service                         │
│  - Business logic                   │
│  - Call repository                  │
│  - Call external providers          │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│  7. Repository                      │
│  - Raw SQL queries                  │
│  - Connection pooling               │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│  8. Response                        │
│  - JSON response                    │
│  - Status code                      │
└─────────────────────────────────────┘
```

### 6.2 Error Handling Flow

```
Error Occurs
     │
     ▼
┌─────────────────────────────────────┐
│  throw AppError(message, status,    │
│                 code)               │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│  Global Error Handler Middleware    │
│  - Log error with context           │
│  - Map to HTTP status               │
│  - Format error response            │
│  - Hide stack trace in production   │
└─────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────┐
│  Error Response:                    │
│  {                                  │
│    "error": {                       │
│      "code": "DOMAIN_NOT_FOUND",    │
│      "message": "Domain not found"  │
│    },                               │
│    "requestId": "uuid"              │
│  }                                  │
└─────────────────────────────────────┘
```

---

## 7. Data Flow Diagrams

### 7.1 Database Schema Relationships

```
┌─────────────┐     1:N      ┌─────────────┐
│    users    │─────────────>│   domains   │
│             │              │             │
│ id (PK)     │              │ id (PK)     │
│ email       │              │ user_id (FK)│
│ role        │              │ domain      │
│ status      │              │ status      │
└─────────────┘              │ recommendation
      │                      └─────────────┘
      │                            │
      │ 1:N                        │ 1:N
      ▼                            ▼
┌─────────────┐              ┌─────────────────────┐
│refresh_tokens│             │domain_check_history │
└─────────────┘              └─────────────────────┘

      │
      │ N:M (via junction table)
      ▼
┌───────────────────────────────────┐
│ reseller_merchant_relationships   │
│                                   │
│ reseller_id (FK → users)          │
│ merchant_id (FK → users)          │
└───────────────────────────────────┘

┌─────────────┐     1:N      ┌─────────────────────┐
│  providers  │─────────────>│  provider_api_logs  │
│             │              │                     │
│ id (PK)     │              │ id (PK)             │
│ name        │              │ provider            │
│ priority    │              │ domain_id (FK)      │
│ enabled     │              │ request_payload     │
│ api_key_enc │              │ response_data       │
└─────────────┘              │ duration_ms         │
                             └─────────────────────┘
```

### 7.2 Scheduled Domain Check Flow (Future)

```
┌─────────────────────────────────────────────────────────────┐
│                  SCHEDULED CHECK WORKFLOW                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Scheduler (cron)                                            │
│       │                                                      │
│       ▼                                                      │
│  ┌─────────────────────────────────────┐                    │
│  │  SELECT domains WHERE               │                    │
│  │    status = 'active' AND            │                    │
│  │    next_check_at <= NOW()           │                    │
│  └─────────────────────────────────────┘                    │
│       │                                                      │
│       ▼                                                      │
│  ┌─────────────────────────────────────┐                    │
│  │  For each domain:                   │                    │
│  │  ├─ Call provider API               │                    │
│  │  ├─ Update domain record            │                    │
│  │  ├─ Create check history            │                    │
│  │  ├─ Calculate next_check_at         │                    │
│  │  │   (based on check_frequency)     │                    │
│  │  └─ Trigger webhooks if changed     │                    │
│  └─────────────────────────────────────┘                    │
│                                                              │
│  Check Frequencies:                                          │
│  ├─ daily:   next_check_at = NOW() + 24 hours               │
│  ├─ weekly:  next_check_at = NOW() + 7 days                 │
│  └─ monthly: next_check_at = NOW() + 30 days                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Logging & Observability

### 8.1 Log Structure

All logs are structured JSON (Pino):

```json
{
  "level": "info",
  "time": "2026-01-16T10:00:00.000Z",
  "requestId": "uuid",
  "userId": "uuid",
  "msg": "Domain check completed",
  "domain": "example.com",
  "provider": "truebiz",
  "recommendation": "pass",
  "durationMs": 245
}
```

### 8.2 Key Log Events

| Event | Level | Description |
|-------|-------|-------------|
| Provider API request | info | Outgoing provider call |
| Provider API response | info | Provider response received |
| Provider API error | error | Provider call failed |
| Domain created | info | New domain added |
| Domain check completed | info | Provider check finished |
| Auth failed | warn | Invalid credentials |
| Validation error | warn | Invalid request data |

---

## 9. Deployment Workflow

### 9.1 Local Development

```bash
# 1. Clone and install
git clone <repo>
npm install

# 2. Configure environment
cp .env.example .env.local
# Edit .env.local with your values

# 3. Start with Docker
docker build -t domain-monitor:latest .
./docker-run-dev.sh

# 4. Run migrations
docker exec domain-monitor npm run migrate

# 5. Add provider
docker exec -it domain-monitor node scripts/add-provider.js
```

### 9.2 Deployment to Server

```bash
# 1. Sync files (SFTP auto-sync on save)
# Or manual: sftp domainmonitor

# 2. SSH to server
ssh domainmonitor

# 3. Rebuild container
cd /var/www/domain-monitor
docker stop domain-monitor
docker rm domain-monitor
docker build -t domain-monitor:latest .
./docker-run-dev.sh

# 4. Run new migrations
docker exec domain-monitor npm run migrate

# 5. Verify
curl https://dev-domainmonitor.ipo-servers.net/health
```

---

## Appendix: Quick Reference

### A. Environment Variables

| Variable | Description |
|----------|-------------|
| `DB_HOST` | MySQL host |
| `DB_USER` | MySQL username |
| `DB_PASSWORD` | MySQL password |
| `DB_NAME` | Database name |
| `JWT_SECRET` | JWT signing secret |
| `ENCRYPTION_KEY` | AES-256 key for API key encryption |
| `NODE_ENV` | development/production |

### B. Common API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/auth/login | Login |
| POST | /api/v1/auth/register | Register |
| GET | /api/v1/domains | List domains |
| POST | /api/v1/domains | Add domain |
| POST | /api/v1/domains/bulk | Bulk add |
| GET | /api/v1/admin/providers | List providers |
| POST | /api/v1/admin/providers | Add provider |

### C. Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Validation error |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not found |
| 409 | Conflict (duplicate) |
| 500 | Server error |
