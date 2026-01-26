# Product Requirements Document (PRD)
# Domain Monitoring Microservice

**Version:** 1.0
**Date:** January 2026
**Status:** Draft

---

## 1. Overview

### 1.1 Product Summary
The Domain Monitoring Microservice is an API-driven headless service that enables monitoring of merchant web presence. It integrates with TrueBiz Web Presence Review API to retrieve and track domain information, providing insights about business legitimacy, industry classification, and risk assessment.

### 1.2 Problem Statement
Organizations need to verify and continuously monitor the legitimacy of merchant domains they interact with. Manual verification is time-consuming and inconsistent. There is no centralized system to track domain status changes over time or alert stakeholders when a domain's risk profile changes.

### 1.3 Solution
A microservice that:
- Manages users and issues JWT tokens for API access
- Allows users to register domains for monitoring
- Integrates with multiple domain intelligence providers (TrueBiz, others)
- Stores and tracks domain data over time
- Notifies users of changes via webhooks and real-time streaming
- Provides filtering and reporting capabilities

---

## 2. Goals and Objectives

### 2.1 Business Goals
| Goal | Success Metric |
|------|----------------|
| Reduce manual domain verification time | 80% reduction in verification effort |
| Enable proactive risk management | Detect 100% of recommendation changes within 24 hours |
| Support merchant onboarding workflows | API response time < 500ms for cached data |

### 2.2 Technical Goals
| Goal | Target |
|------|--------|
| API Availability | 99.9% uptime |
| Response Time | p95 < 200ms for read operations |
| Scalability | Support 10,000+ monitored domains per user |
| GDPR Compliance | Data retention policies enforced automatically |

### 2.3 Non-Goals (Out of Scope)
- Billing and subscription management
- Mobile or web UI

---

## 3. User Stories

### 3.1 Domain Management
| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-01 | API Consumer | Add a single domain for monitoring | I can track a new merchant |
| US-02 | API Consumer | Add multiple domains in bulk | I can efficiently onboard many merchants |
| US-03 | API Consumer | Retrieve domain details | I can see the current status and recommendation |
| US-04 | API Consumer | View full domain intelligence | I can access all TrueBiz data for due diligence |
| US-05 | API Consumer | List all my monitored domains | I can see my complete portfolio |
| US-06 | API Consumer | Filter domains by status/recommendation | I can focus on domains needing attention |
| US-07 | API Consumer | Stop monitoring a domain | I can remove merchants I no longer work with |
| US-08 | API Consumer | Restart monitoring a domain | I can resume tracking a previously paused merchant |
| US-09 | API Consumer | Perform bulk operations | I can efficiently manage large portfolios |

### 3.2 User Management
| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-10 | New User | Register an account | I can access the API |
| US-11 | User | Login and receive a JWT token | I can authenticate API requests |
| US-12 | User | Refresh my JWT token | I maintain access without re-login |
| US-13 | User | Update my profile | I can change my email/password |
| US-14 | User | Reset my password | I can recover account access |
| US-15 | Admin | Manage user accounts | I can enable/disable users |

### 3.3 Notifications & Real-Time Updates
| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-16 | API Consumer | Configure a webhook endpoint | I receive notifications about domain changes |
| US-17 | API Consumer | Receive domain check notifications | I know when new data is available |
| US-18 | API Consumer | Receive recommendation change alerts | I can act on risk changes immediately |
| US-19 | API Consumer | Subscribe to real-time updates via SSE | I get instant notifications without polling |
| US-20 | API Consumer | Filter real-time events by type | I only receive events I care about |

### 3.4 Multi-Provider Support
| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-21 | API Consumer | See which provider was used for a check | I understand data source |
| US-22 | Admin | Configure multiple domain check providers | We have redundancy and flexibility |
| US-23 | Admin | Set provider priority/fallback order | Checks continue if primary provider fails |

### 3.5 Security
| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US-24 | API Consumer | Authenticate with JWT tokens | My data is protected |
| US-25 | API Consumer | Verify webhook signatures | I can trust incoming notifications |

---

## 4. Functional Requirements

### 4.1 Domain Management

#### FR-01: Add Single Domain
- **Input:** Domain name, optional check frequency, optional userId
- **Validation:**
  - Domain must be valid format (RFC 1035)
  - Domain max length: 255 characters
  - Check frequency: 7, 30, or 90 days (default: 7)
  - userId: Valid user UUID (superadmin/reseller only)
- **Behavior:**
  - Create domain record with status "active"
  - Queue initial TrueBiz check
  - Return created domain with ID
  - If check frequency is specified, domain montiroing is started with the provider
  - If no check frequency is specified, a web presence review is returned
- **Authorization:**
  - Superadmin/Reseller: Can specify `userId` to add domains for a merchant user
  - Merchant: Cannot specify userId, domains added to own account
- **Constraints:**
  - User cannot add duplicate domains
  - Maximum 10,000 domains per user

#### FR-02: Add Domains in Bulk
- **Input:** Array of domain objects (max 100 per request), optional userId
- **Behavior:**
  - Validate each domain independently
  - Create valid domains, collect errors for invalid ones
  - Trigger provider check for each successfully created domain
  - Log all provider API calls (request and response)
  - Return success/failure breakdown including provider check results
- **Authorization:**
  - Superadmin/Reseller: Can specify `userId` to add domains for a merchant user
  - Merchant: Cannot specify userId, domains added to own account
- **Response:**
  - `success`: Array of created domains
  - `failed`: Array of domains that failed to create
  - `providerChecks`: Summary of provider API call results
    - `checked`: Count of successful provider checks
    - `failed`: Count of failed provider checks
    - `failures`: Array of failure details (domainId, domain, error)
- **Constraints:**
  - Partial success allowed (some fail, others succeed)
  - Provider check failures don't prevent domain creation

#### FR-03: Retrieve Domain
- **Input:** Domain ID
- **Behavior:**
  - Return domain with current data
  - Include recommendation, industry, business type
- **Constraints:**
  - User can only access their own domains

#### FR-04: Retrieve Domain Details
- **Input:** Domain ID
- **Behavior:**
  - Return domain with full TrueBiz raw data
- **Use Case:** "View More Detail" functionality

#### FR-05: Retrieve Domains in Bulk
- **Input:** Array of domain IDs (max 100)
- **Behavior:**
  - Return found domains
  - List not found IDs separately

#### FR-06: List Domains (Paginated)
- **Input:** Page, limit, sort options
- **Behavior:**
  - Return paginated list of user's domains
  - Default: 20 per page, max 100
  - Sort by createdAt (desc) by default
- **Output:** Domains array + pagination metadata

#### FR-07: Filter Domains
- **Input:** Query parameters for filtering
- **Filters:**
  - status: active | inactive
  - recommendation: pass | fail | review
  - industry: string match
  - businessType: string match
  - search: partial match on domain/name
- **Behavior:**
  - Apply filters to paginated list query

#### FR-08: Stop Monitoring (Single)
- **Input:** Domain ID
- **Behavior:**
  - Set status to "inactive"
  - Cancel scheduled checks
- **Note:** Domain data is retained

#### FR-09: Stop Monitoring (Bulk)
- **Input:** Array of domain IDs
- **Behavior:**
  - Update all valid IDs to inactive
  - Return success/notFound breakdown

#### FR-10: Restart Monitoring (Single)
- **Input:** Domain ID
- **Behavior:**
  - Set status to "active"
  - Schedule next check based on frequency
  - Queue immediate check

#### FR-11: Restart Monitoring (Bulk)
- **Input:** Array of domain IDs
- **Behavior:**
  - Update all valid IDs to active
  - Return success/notFound breakdown

### 4.2 User Management

#### FR-12: User Registration
- **Input:** Email, password, name (optional)
- **Validation:**
  - Email must be valid format and unique
  - Password minimum 8 characters, 1 uppercase, 1 number
- **Behavior:**
  - Create user record with hashed password
  - Generate email verification token
  - Return user ID (no auto-login)
- **Security:**
  - Password hashed with bcrypt (cost factor 12)

#### FR-13: User Login
- **Input:** Email, password
- **Behavior:**
  - Validate credentials
  - Generate JWT access token (15 min expiry)
  - Generate refresh token (7 days expiry)
  - Log login attempt
- **Output:**
  - accessToken: JWT for API authentication
  - refreshToken: Token for obtaining new access tokens
  - expiresIn: Seconds until access token expires

#### FR-14: Token Refresh
- **Input:** Refresh token
- **Behavior:**
  - Validate refresh token
  - Generate new access token
  - Optionally rotate refresh token
- **Security:**
  - Refresh tokens stored hashed in database
  - Old refresh tokens invalidated on rotation

#### FR-15: Password Reset
- **Input:** Email (request), token + new password (reset)
- **Behavior:**
  - Generate time-limited reset token (1 hour)
  - Send reset email (integration with email service)
  - Validate token and update password
- **Security:**
  - Token single-use
  - Invalidate all existing sessions on reset

#### FR-16: User Profile Management
- **Operations:** Get profile, update profile, change password
- **Constraints:**
  - Users can only access/modify their own profile
  - Password change requires current password

### 4.3 Webhooks

#### FR-17: Configure Webhook
- **Input:** URL, events array, optional secret
- **Events:**
  - domain.checked: Domain check completed
  - recommendation.changed: Recommendation value changed
  - domain.failed: Check failed after retries
- **Behavior:**
  - Generate secret if not provided
  - Store webhook configuration
  - Return webhook ID and secret

#### FR-18: Webhook Delivery
- **Trigger:** Domain events occur
- **Behavior:**
  - Send POST to configured URL
  - Include HMAC-SHA256 signature in header
  - Retry 3 times with exponential backoff
  - Log delivery attempts

### 4.4 Real-Time Streaming (Server-Sent Events)

#### FR-19: SSE Connection
- **Endpoint:** GET /api/v1/events/stream
- **Authentication:** JWT token (query param or header)
- **Behavior:**
  - Establish persistent SSE connection
  - Send heartbeat every 30 seconds
  - Auto-reconnect support with Last-Event-ID
- **Connection Limits:**
  - Max 5 concurrent connections per user
  - Connection timeout: 1 hour (client should reconnect)

#### FR-20: Event Filtering
- **Query Parameters:**
  - events: Comma-separated event types to subscribe
  - domainIds: Optional filter for specific domains
- **Example:** `/api/v1/events/stream?events=domain.checked,recommendation.changed`

#### FR-21: Event Format
```
event: domain.checked
id: evt_123456
data: {"domainId":"uuid","domain":"example.com","recommendation":"pass","timestamp":"2026-01-15T10:00:00Z"}

event: recommendation.changed
id: evt_123457
data: {"domainId":"uuid","domain":"example.com","previous":"pass","current":"fail","timestamp":"2026-01-15T10:05:00Z"}
```

### 4.5 Multi-Provider Integration

#### FR-22: Provider Abstraction
- **Supported Providers:**
  - TrueBiz (primary)
  - Additional providers can be added via provider interface
- **Provider Interface:**
  - `checkDomain(domain)`: Fetch domain data
  - `normalize(response)`: Map to internal schema
  - `healthCheck()`: Verify provider availability

#### FR-23: Provider Configuration
- **Admin-Level Settings:**
  - Enable/disable providers
  - Set provider priority order
  - Configure per-provider API keys
  - Set rate limits per provider
- **Storage:** providers table in database

#### FR-24: Provider Selection & Fallback
- **Selection Logic:**
  1. Use highest priority enabled provider
  2. On failure (timeout, error, rate limit), try next provider
  3. Log which provider was used
- **Domain Record:**
  - Store `provider` field indicating data source
  - Store `providerResponseId` for traceability

#### FR-25: Domain Check (Multi-Provider)
- **Trigger:** New domain added, scheduled check, manual restart
- **Behavior:**
  - Select provider based on priority/availability
  - Call provider API with domain
  - Map response using provider's normalize function
  - Store raw response and provider info
  - Update domain record
  - Trigger webhooks/SSE events

#### FR-26: Provider Data Mapping
Each provider implements its own mapping to the internal schema:

| Internal Field | TrueBiz Source | Provider B Source |
|----------------|----------------|-------------------|
| recommendation | recommendation | risk_level |
| name | name | business_name |
| industry | industry.primary_industry | category |
| businessType | formation_type | entity_type |
| foundedYear | founded_year | year_established |
| rawData | (full response) | (full response) |
| provider | "truebiz" | "provider_b" |

#### FR-27: Provider API Logging
- **Trigger:** Every provider API call (domain checks, health checks)
- **Behavior:**
  - Log request payload, timestamp
  - Log response status, data, timestamp
  - Calculate and store duration
  - Store error message if call failed
  - Link to domain record if applicable
- **Storage:** provider_api_logs table
- **Retention:** Configurable (default 30 days)
- **Use Cases:**
  - Debugging provider integration issues
  - Monitoring provider performance and reliability
  - Compliance audit trail
  - API cost tracking

---

## 5. API Specification

### 5.1 Base URL
```
/api/v1
```

### 5.2 Authentication
All endpoints (except auth endpoints) require JWT token in Authorization header:
```
Authorization: Bearer <jwt_token>
```
Tokens are issued by this service via the `/auth/login` endpoint.

### 5.3 Endpoints Summary

#### Authentication (Public)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/register | Register new user |
| POST | /auth/login | Login and get tokens |
| POST | /auth/refresh | Refresh access token |
| POST | /auth/forgot-password | Request password reset |
| POST | /auth/reset-password | Reset password with token |

#### User Profile (Authenticated)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /users/me | Get current user profile |
| PATCH | /users/me | Update current user profile |
| POST | /users/me/change-password | Change password |

#### Domains (Authenticated)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /domains | Add single domain |
| POST | /domains/bulk | Add multiple domains |
| GET | /domains/:id | Get domain by ID |
| GET | /domains/:id/details | Get domain with full provider data |
| POST | /domains/bulk/retrieve | Get multiple domains by IDs |
| GET | /domains | List domains (paginated, filtered) |
| PATCH | /domains/:id/stop | Stop monitoring domain |
| PATCH | /domains/bulk/stop | Stop monitoring multiple domains |
| PATCH | /domains/:id/start | Restart monitoring domain |
| PATCH | /domains/bulk/start | Restart monitoring multiple domains |

#### Webhooks (Authenticated)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /webhooks | Configure webhook |
| GET | /webhooks | List webhooks |
| DELETE | /webhooks/:id | Delete webhook |

#### Real-Time Events (Authenticated)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /events/stream | SSE stream for real-time updates |

#### Providers (Admin Only)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /admin/providers | List all providers |
| PATCH | /admin/providers/:id | Update provider config |
| GET | /admin/providers/:id/health | Check provider health |

#### System
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /health | Health check |

### 5.4 Error Response Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid domain format",
    "details": [
      { "field": "domain", "message": "Must be a valid domain name" }
    ]
  },
  "requestId": "uuid"
}
```

### 5.5 HTTP Status Codes
| Code | Usage |
|------|-------|
| 200 | Success (GET, PATCH) |
| 201 | Created (POST) |
| 400 | Validation error |
| 401 | Invalid/missing JWT |
| 403 | Forbidden (accessing other user's data) |
| 404 | Resource not found |
| 409 | Conflict (duplicate domain) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

## 6. Data Model

### 6.1 User Entity
```
User {
  id: UUID (primary key)
  email: string (unique, max 255)
  passwordHash: string
  name: string | null
  role: enum [superadmin, reseller, merchant]
  status: enum [active, inactive, pending_verification]
  emailVerifiedAt: timestamp | null
  lastLoginAt: timestamp | null
  createdAt: timestamp
  updatedAt: timestamp
}
```

**User Roles:**
- **superadmin**: Full system access, can manage providers, view all data, perform all operations
- **reseller**: Read-only access to multiple merchants' domain data (merchants they are assigned to)
- **merchant**: Read-only access to their own domain data only

### 6.2 Refresh Token Entity
```
RefreshToken {
  id: UUID (primary key)
  userId: UUID (foreign key)
  tokenHash: string
  expiresAt: timestamp
  revokedAt: timestamp | null
  createdAt: timestamp
}
```

### 6.3 Domain Entity
```
Domain {
  id: UUID (primary key)
  userId: UUID (foreign key)
  domain: string (max 255)
  name: string (business name from provider)
  status: enum [active, inactive]
  recommendation: enum [pass, fail, review] | null
  industry: string | null
  businessType: string | null
  foundedYear: number | null
  rawData: JSON | null
  provider: string (provider name used for last check)
  providerResponseId: string | null (provider's reference ID)
  checkFrequency: enum ['7', '30', '90'] (days)
  lastCheckedAt: timestamp | null
  nextCheckAt: timestamp | null
  createdAt: timestamp
  updatedAt: timestamp
}
```

### 6.4 Provider Entity
```
Provider {
  id: UUID (primary key)
  name: string (unique identifier, e.g., "truebiz")
  displayName: string
  enabled: boolean
  priority: integer (lower = higher priority)
  apiBaseUrl: string
  apiKeyEncrypted: string
  rateLimit: integer (requests per minute)
  timeout: integer (milliseconds)
  config: JSON (provider-specific settings)
  createdAt: timestamp
  updatedAt: timestamp
}
```

### 6.5 Webhook Entity
```
Webhook {
  id: UUID (primary key)
  userId: UUID (foreign key)
  url: string (max 500)
  events: JSON array
  secret: string
  active: boolean
  createdAt: timestamp
  updatedAt: timestamp
}
```

### 6.6 Reseller-Merchant Relationship Entity
```
ResellerMerchantRelationship {
  id: UUID (primary key)
  resellerId: UUID (foreign key → users.id where role='reseller')
  merchantId: UUID (foreign key → users.id where role='merchant')
  createdAt: timestamp
}
```

**Purpose:** Defines which merchants a reseller can access. A reseller can view domains for all assigned merchants.

### 6.7 Provider API Log Entity
```
ProviderApiLog {
  id: UUID (primary key)
  domainId: UUID | null (foreign key → domains.id)
  provider: string (provider name)
  endpoint: string (API endpoint called)
  method: string (HTTP method)
  requestPayload: JSON | null
  responseStatus: integer | null
  responseData: JSON | null
  errorMessage: string | null
  requestTimestamp: timestamp
  responseTimestamp: timestamp
  durationMs: integer (computed)
  createdAt: timestamp
}
```

**Purpose:** Audit trail for all provider API calls, useful for debugging, monitoring, and compliance.

### 6.8 Database Tables
- users
- refresh_tokens
- domains
- providers
- webhooks
- webhook_delivery_logs
- domain_check_history
- reseller_merchant_relationships
- provider_api_logs

---

## 7. Non-Functional Requirements

### 7.1 Performance
| Requirement | Target |
|-------------|--------|
| API Response Time (cached) | p95 < 200ms |
| API Response Time (with TrueBiz call) | p95 < 3s |
| Bulk Operations | 100 items < 5s |
| Concurrent Users | 100+ |

### 7.2 Availability
| Requirement | Target |
|-------------|--------|
| Uptime | 99.9% |
| Recovery Time Objective (RTO) | < 1 hour |
| Recovery Point Objective (RPO) | < 5 minutes |

### 7.3 Security
| Requirement | Implementation |
|-------------|----------------|
| Authentication | JWT tokens issued by this service |
| Password Storage | bcrypt with cost factor 12 |
| Token Security | Short-lived access (15min), refresh rotation |
| Authorization | Role-based access control (see 7.3.1) |
| Data in Transit | HTTPS/TLS 1.2+ |
| Data at Rest | RDS encryption |
| SQL Injection | Parameterized queries |
| Secrets Management | AWS Secrets Manager |
| Provider API Keys | Encrypted at rest in database |
| Audit Logging | All mutations logged with user ID |

#### 7.3.1 Role-Based Access Control (RBAC)

**Superadmin Role:**
- Full CRUD access to all resources
- Can manage providers (CRUD operations)
- Can view/manage all users' domains
- Can create/update/delete any domain
- Can add domains on behalf of any merchant user (via `userId` parameter)
- Can access all admin endpoints

**Reseller Role:**
- Can add domains on behalf of assigned merchant user (via `userId` parameter)
- Can list domains for all assigned merchant users
- Can view domain details for assigned merchant users
- Cannot manage providers
- Cannot access admin endpoints

**Merchant Role:**
- Read-only access to own domains only
- Can list own domains
- Can view own domain details
- Cannot add, update, or delete domains
- Cannot manage providers
- Cannot access admin endpoints

**Permission Enforcement:**
- Domain queries filtered by user role and relationships
- API endpoints validate role before performing operations
- Database queries include user_id or reseller-merchant relationship filters

### 7.4 Compliance (GDPR)
| Requirement | Implementation |
|-------------|----------------|
| Data Retention | 30-day retention after deletion |
| Right to Deletion | Soft delete + scheduled hard delete |
| Data Export | API endpoint for user data export |
| Audit Trail | domain_check_history table |

### 7.5 Observability
| Requirement | Implementation |
|-------------|----------------|
| Logging | Pino (JSON structured) → CloudWatch |
| Request Tracing | Request ID on every request |
| Metrics | CloudWatch custom metrics |
| Alerting | CloudWatch Alarms |
| Health Check | /health endpoint for ALB |

---

## 8. Technical Architecture

### 8.1 Tech Stack
| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20 LTS |
| Language | JavaScript (ES6+) |
| Framework | Express.js |
| Database | MySQL 8.4 (AWS RDS) |
| DB Driver | mysql2 (raw SQL) |
| Auth | jsonwebtoken (JWT), bcrypt |
| Validation | Joi |
| HTTP Client | Axios + axios-retry |
| Real-Time | Native SSE (no library needed) |
| Logging | Pino |
| Testing | Jest + Supertest |
| Container | Docker |

### 8.2 Architecture Layers
```
Request → Route → Controller → Service → Repository → Database
                      ↓
                  Validator
```

- **Routes:** HTTP method + path definitions only
- **Controllers:** Parse request, call service, format response (thin)
- **Services:** Business logic, orchestration
- **Repositories:** Raw SQL queries only
- **Validators:** Joi schema definitions

### 8.3 AWS Infrastructure
- API Gateway + WAF
- Application Load Balancer
- ECS Fargate (containers)
- RDS MySQL 8.4
- CloudWatch (logs, metrics)
- Secrets Manager

---

## 9. External Dependencies

### 9.1 Domain Intelligence Providers

#### 9.1.1 TrueBiz (Primary)
- **Purpose:** Primary domain intelligence provider
- **Documentation:** https://ae.truebiz.io/api/v1/docs
- **Rate Limits:** Configured per provider settings
- **Retry Strategy:** 3 retries with exponential backoff
- **Fallback:** Try next provider in priority order

#### 9.1.2 Additional Providers
- Additional providers can be added by implementing the provider interface
- Each provider requires:
  - API client implementation
  - Response normalization to internal schema
  - Health check endpoint

### 9.2 Email Service (for Password Reset)
- **Purpose:** Send password reset emails
- **Options:** AWS SES, SendGrid, or similar
- **Fallback:** Log email content for manual handling in MVP

---

## 10. Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Primary provider unavailable | Cannot check new domains | Medium | Multi-provider fallback, cache last known data |
| Provider rate limiting | Delayed checks | Medium | Per-provider rate limiter, distribute across providers |
| MySQL connection exhaustion | API failures | Low | Connection pooling, limits |
| Webhook delivery failures | Missed notifications | Medium | Retry with backoff, delivery log |
| SSE connection overload | Server memory issues | Medium | Connection limits per user, heartbeat timeouts |
| JWT secret compromise | Auth bypass | Low | Key rotation support, short token expiry |
| Password brute force | Account compromise | Medium | Rate limiting on auth endpoints, account lockout |

---

## 11. Future Considerations

Items for future enhancement:

| Feature | Trigger to Add |
|---------|----------------|
| Redis caching | DB read load > threshold |
| AWS SQS for async checks | API response time > 3s |
| Background re-check worker | Scale beyond 10k domains |
| OAuth2/Social login | User request |
| API key authentication | For server-to-server integrations |
| WebSocket support | If SSE insufficient for use case |
| Provider analytics dashboard | Business reporting needs |

---

## 12. Success Criteria

### 12.1 MVP Launch Criteria
- [ ] User registration and login working
- [ ] JWT authentication with refresh tokens
- [ ] All domain management endpoints implemented
- [ ] Multi-provider integration with TrueBiz as primary
- [ ] Provider fallback working correctly
- [ ] Webhook delivery functional with signatures
- [ ] SSE real-time streaming operational
- [ ] 80%+ test coverage on business logic
- [ ] Health check endpoint responding
- [ ] Successfully deployed to AWS ECS
- [ ] Documentation complete

### 12.2 Post-Launch Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| API Error Rate | < 1% | CloudWatch |
| Average Response Time | < 200ms | CloudWatch |
| Webhook Delivery Success | > 99% | Delivery log |
| Domain Check Success | > 95% | Check history |
| SSE Connection Stability | > 99% | Connection logs |
| Provider Fallback Usage | < 5% | Provider logs |
| Auth Success Rate | > 99.5% | Auth logs |

---

## 13. Appendix

### A. Glossary
| Term | Definition |
|------|------------|
| Domain | A merchant's web domain being monitored |
| Provider | External API service for domain intelligence (e.g., TrueBiz) |
| Recommendation | Provider's risk assessment (pass/fail/review) |
| Check | Process of fetching domain data from a provider |
| Webhook | HTTP callback for event notifications |
| SSE | Server-Sent Events - one-way real-time communication |
| JWT | JSON Web Token - stateless authentication token |
| Refresh Token | Long-lived token used to obtain new access tokens |

### B. References
- TrueBiz API Docs: https://ae.truebiz.io/api/v1/docs
- JWT Specification: https://jwt.io/introduction
- SSE Specification: https://html.spec.whatwg.org/multipage/server-sent-events.html
- System Workflow: See `docs/WORKFLOW.md`
- Provider Setup Guide: See `docs/PROVIDER-SETUP.md`
- Docker Setup: See `README-DOCKER.md`
- API Documentation: See `docs/swagger.yaml`

### C. Revision History
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 2026 | - | Initial draft |
| 1.1 | Jan 2026 | - | Added user management, multi-provider support, real-time streaming |
