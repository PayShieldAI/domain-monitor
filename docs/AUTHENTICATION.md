# Authentication Guide

## Overview

The Domain Monitor API supports two authentication methods:

1. **JWT Bearer Tokens** - For user authentication (login-based)
2. **API Keys** - For machine-to-machine authentication (system-level)

## Quick Decision Tree

**Which authentication method should I use?**

```
Are you a human user logging into the system?
│
├─ YES → Use JWT Bearer Tokens
│         • Register/Login with email & password
│         • Receive access token (15 min expiry)
│         • Use refresh token for new access tokens
│         • Access user-specific data (domains, profile)
│
└─ NO → Are you an external system/service?
         │
         └─ YES → Use API Keys
                  • Get API key from superadmin
                  • Generate JWT tokens for users
                  • System-level operations only
                  • No user-specific data access
```

**Current API Key Capabilities** (as of v1.0.0):
- ✅ Generate JWT tokens for any user
- ❌ Direct domain operations (requires JWT)
- ❌ User profile access (requires JWT)
- ❌ Admin operations (requires JWT)

---

## Authentication Methods

### 1. JWT Bearer Token Authentication

**Use Case**: Human users accessing the API through applications

**How it works**:
1. User logs in with email/password
2. Receives a JWT access token (expires in 15 minutes)
3. Uses token in Authorization header for subsequent requests

**Login Flow**:
```bash
# Step 1: Login
curl -X POST https://your-domain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "YourPassword123"
  }'

# Response:
{
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "abc123...",
    "expiresIn": 900
  }
}

# Step 2: Use the token
curl -X GET https://your-domain.com/api/v1/domains \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

**Token Refresh**:
```bash
curl -X POST https://your-domain.com/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "abc123..."
  }'
```

**User Roles**:
- `merchant` - Regular users, domain owners
- `reseller` - Partners with multiple merchants
- `superadmin` - System administrators

---

### 2. API Key Authentication

**Use Case**: External systems, integrations, automated processes

**How it works**:
1. Superadmin creates an API key via management endpoint
2. External system stores the key securely
3. System includes key in X-API-Key header for requests

**Create API Key** (superadmin only):
```bash
curl -X POST https://your-domain.com/api/v1/admin/api-keys \
  -H "Authorization: Bearer <superadmin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Payment Gateway Integration",
    "description": "Used for domain verification in checkout flow",
    "permissions": ["domains:read", "tokens:generate"],
    "expiresAt": "2026-12-31T23:59:59Z"
  }'

# Response (API key shown only once!):
{
  "message": "API key created successfully",
  "warning": "Store this API key securely. It will not be shown again.",
  "data": {
    "id": "key-uuid",
    "apiKey": "dmk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "keyPrefix": "dmk_a1b2c3d4",
    "name": "Payment Gateway Integration",
    ...
  }
}
```

**Use API Key**:
```bash
curl -X GET https://your-domain.com/api/v1/domains \
  -H "X-API-Key: dmk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
```

**Key Features**:
- Prefix: `dmk_` (Domain Monitor Key)
- Never expires by default (or set custom expiration)
- Can be revoked instantly
- Tracks last usage timestamp
- Supports permission scopes (for future granular access)

---

## Flexible Authentication Endpoints

Some endpoints accept **both** JWT and API Key authentication:

| Endpoint | JWT (Superadmin) | API Key | Description |
|----------|------------------|---------|-------------|
| `POST /api/v1/auth/generate-user-token` | ✅ | ✅ | Generate JWT for any user |

**Example with JWT**:
```bash
curl -X POST https://your-domain.com/api/v1/auth/generate-user-token \
  -H "Authorization: Bearer <superadmin_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-uuid"}'
```

**Example with API Key**:
```bash
curl -X POST https://your-domain.com/api/v1/auth/generate-user-token \
  -H "X-API-Key: dmk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-uuid"}'
```

---

## Authorization Levels & Endpoint Support

### Public Endpoints (No Authentication)
No authentication required:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/v1/auth/register` | POST | User registration |
| `/api/v1/auth/login` | POST | User login |
| `/api/v1/auth/refresh` | POST | Refresh access token |
| `/api/v1/auth/forgot-password` | POST | Request password reset |
| `/api/v1/auth/reset-password` | POST | Reset password with token |

### User Endpoints (JWT Required)
Requires valid JWT token (any authenticated user):

| Endpoint | Method | Auth Type | Description |
|----------|--------|-----------|-------------|
| `/api/v1/users/me` | GET | JWT Only | Get user profile |
| `/api/v1/users/me` | PATCH | JWT Only | Update user profile |
| `/api/v1/auth/logout` | POST | JWT Only | Logout user |
| `/api/v1/auth/change-password` | POST | JWT Only | Change password |

### Domain Endpoints (JWT Required - Merchant/Reseller)
Requires JWT token with merchant or reseller role:

| Endpoint | Method | Auth Type | Description |
|----------|--------|-----------|-------------|
| `/api/v1/domains` | GET | JWT Only | List domains |
| `/api/v1/domains` | POST | JWT Only | Create domain |
| `/api/v1/domains/:id` | GET | JWT Only | Get domain details |
| `/api/v1/domains/:id` | PATCH | JWT Only | Update domain |
| `/api/v1/domains/:id` | DELETE | JWT Only | Delete domain |
| `/api/v1/domains/bulk` | POST | JWT Only | Bulk operations |

**Why JWT Only?** Domain endpoints require user context for tenant isolation. Each user can only access their own domains.

### Superadmin Endpoints (JWT Required)
Requires JWT token with superadmin role:

| Endpoint | Method | Auth Type | Description |
|----------|--------|-----------|-------------|
| `/api/v1/admin/providers` | GET | JWT Only | List providers |
| `/api/v1/admin/providers` | POST | JWT Only | Create provider |
| `/api/v1/admin/providers/:id` | GET | JWT Only | Get provider |
| `/api/v1/admin/providers/:id` | PATCH | JWT Only | Update provider |
| `/api/v1/admin/providers/:id` | DELETE | JWT Only | Delete provider |
| `/api/v1/admin/api-keys` | GET | JWT Only | List API keys |
| `/api/v1/admin/api-keys` | POST | JWT Only | Create API key |
| `/api/v1/admin/api-keys/:id` | GET | JWT Only | Get API key |
| `/api/v1/admin/api-keys/:id` | PATCH | JWT Only | Update API key |
| `/api/v1/admin/api-keys/:id` | DELETE | JWT Only | Delete API key |
| `/api/v1/admin/api-keys/:id/revoke` | POST | JWT Only | Revoke API key |

**Why JWT Only?** Admin operations require audit trail of who performed the action. API keys are system-level and don't track individual admin users.

### Flexible Authentication Endpoints (JWT or API Key)
Accepts **either** API Key OR superadmin JWT:

| Endpoint | Method | Auth Types | Access Level |
|----------|--------|-----------|--------------|
| `/api/v1/auth/generate-user-token` | POST | JWT (superadmin) OR API Key | System-level operation |

**Use Cases for API Key**:
- External systems generating tokens for users (SSO, partner integrations)
- Automated provisioning systems
- CI/CD pipelines creating test users

**Use Cases for JWT**:
- Superadmin helping users (support scenarios)
- Manual token generation for testing

---

## Common Authentication Patterns

### Pattern 1: User Dashboard
**Scenario**: User logs into web application

```javascript
// Frontend login
const response = await fetch('/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

const { data } = await response.json();
localStorage.setItem('accessToken', data.accessToken);
localStorage.setItem('refreshToken', data.refreshToken);

// Subsequent requests
const domains = await fetch('/api/v1/domains', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
  }
});
```

### Pattern 2: External Integration
**Scenario**: Payment gateway verifying domains

```javascript
// External system using API key
const axios = require('axios');

const client = axios.create({
  baseURL: 'https://your-domain.com/api/v1',
  headers: {
    'X-API-Key': process.env.DOMAIN_MONITOR_API_KEY
  }
});

// Check domain status
const { data } = await client.get('/domains/check', {
  params: { domain: 'example.com' }
});
```

### Pattern 3: Token Delegation
**Scenario**: External system generating tokens for users

```javascript
// External system (e.g., SSO provider) generating tokens
async function generateUserToken(userId) {
  const response = await axios.post(
    'https://your-domain.com/api/v1/auth/generate-user-token',
    { userId },
    {
      headers: {
        'X-API-Key': process.env.DOMAIN_MONITOR_API_KEY,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data.data.accessToken;
}

// Pass token to frontend
const userToken = await generateUserToken('user-uuid');
// User can now use this token to access their own data
```

---

## Security Best Practices

### For JWT Tokens
1. **Short expiration**: Tokens expire in 15 minutes
2. **Use refresh tokens**: Don't store passwords, use refresh flow
3. **HTTPS only**: Never send tokens over HTTP
4. **Secure storage**: Use httpOnly cookies or secure localStorage
5. **Logout properly**: Revoke refresh tokens on logout

### For API Keys
1. **Environment variables**: Store in `.env` or secrets manager
2. **Never commit**: Add to `.gitignore`
3. **Rotate regularly**: Create new keys periodically
4. **Minimal permissions**: Only grant necessary scopes
5. **Monitor usage**: Check `lastUsedAt` for suspicious activity
6. **Revoke compromised keys**: Immediate revocation on leak
7. **One key per integration**: Don't share across systems

### For Both
1. **Rate limiting**: Implement on all authentication endpoints
2. **Log failures**: Monitor failed authentication attempts
3. **IP whitelisting**: Restrict API keys to known IPs (optional)
4. **Audit trail**: Log all authentication events
5. **2FA**: Consider for superadmin accounts (future)

---

## Error Handling

### Common Authentication Errors

**401 Unauthorized - Missing Credentials**
```json
{
  "error": {
    "code": "MISSING_AUTH",
    "message": "Missing authorization header"
  }
}
```

**401 Unauthorized - Invalid Token**
```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Invalid token"
  }
}
```

**401 Unauthorized - Expired Token**
```json
{
  "error": {
    "code": "TOKEN_EXPIRED",
    "message": "Token expired"
  }
}
```

**401 Unauthorized - Invalid API Key**
```json
{
  "error": {
    "code": "INVALID_API_KEY",
    "message": "Invalid API key"
  }
}
```

**403 Forbidden - Insufficient Permissions**
```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "Superadmin access required"
  }
}
```

---

## Testing Authentication

### Test User Login
```bash
# Register a test user
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234",
    "name": "Test User",
    "role": "merchant"
  }'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test1234"
  }'
```

### Test API Key
```bash
# Create API key (requires superadmin token)
curl -X POST http://localhost:3000/api/v1/admin/api-keys \
  -H "Authorization: Bearer <superadmin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Key",
    "description": "For testing"
  }'

# Test the API key
curl -X GET http://localhost:3000/api/v1/domains \
  -H "X-API-Key: dmk_your_test_key"
```

---

## Troubleshooting

### Issue: "Invalid token" after a while
**Solution**: Token expired. Use refresh token to get new access token.

### Issue: "Missing authorization header" with API key
**Solution**: Use `X-API-Key` header, not `Authorization`.

### Issue: "Superadmin access required" with valid token
**Solution**: Your user account doesn't have superadmin role. Contact admin.

### Issue: API key not working
**Possible causes**:
- Key expired (check `expiresAt`)
- Key revoked (check `revokedAt`)
- Wrong format (must start with `dmk_`)
- Network issues reaching RDS database

### Issue: Can't create API key
**Solution**: Only superadmin users can create API keys. You need a superadmin JWT token.

---

## API Reference

For complete API documentation with request/response schemas, see:
- [Swagger Documentation](./swagger.yaml)
- [API Key Management Guide](./API-KEY-GUIDE.md)

---

## Migration Guide

### From JWT-only to Hybrid Auth

If you're adding API key support to existing endpoints:

```javascript
// Before: JWT only
router.get('/endpoint', authenticate, controller.method);

// After: Support both JWT and API key
const { authenticateFlexible } = require('../middlewares/auth');
router.get('/endpoint', authenticateFlexible, controller.method);
```

### Accessing Auth Info in Controllers

```javascript
// JWT authentication
if (req.user) {
  console.log('Authenticated via JWT');
  console.log('User ID:', req.user.id);
  console.log('User role:', req.user.role);
}

// API key authentication
if (req.apiKey) {
  console.log('Authenticated via API key');
  console.log('Key name:', req.apiKey.name);
  console.log('Permissions:', req.apiKey.permissions);
}
```
