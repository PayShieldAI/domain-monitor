# API Key Authentication Guide

## Overview

The Domain Monitor API supports **API Key authentication** for machine-to-machine (M2M) communication. This allows external systems to authenticate without user credentials.

## Key Features

- **Secure**: API keys are hashed using bcrypt (never stored in plain text)
- **Prefix-based**: Keys use `dmk_` prefix for easy identification
- **Flexible**: Support for permissions, expiration dates, and revocation
- **Auditable**: Track last usage, creator, and lifecycle events
- **Management**: Full CRUD operations via REST API (superadmin only)

## Quick Reference

### API Key Support Matrix

| Authentication Method | Supported Endpoints | Use Case |
|----------------------|---------------------|----------|
| **API Key** | `/api/v1/auth/generate-user-token` | Generate JWT tokens for users programmatically |
| **JWT Only** | All other endpoints | User operations, admin operations |

**Key Takeaway**: API keys are currently used for **token generation** workflows. Most operational endpoints require JWT for user context and tenant isolation.

---

## API Key Format

API keys follow this format:

```
dmk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
│   └──────────────────┬──────────────────┘
│                      └─ 32 random hex characters
└─ Prefix (Domain Monitor Key)
```

The first 12 characters (`dmk_a1b2c3d4`) serve as a prefix for quick lookup.

---

## Creating API Keys

### Via API (Superadmin Required)

```bash
curl -X POST https://your-domain.com/api/v1/admin/api-keys \
  -H "Authorization: Bearer <superadmin_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Payment Gateway Integration",
    "description": "Used by payment gateway to verify domains",
    "permissions": ["domains:read", "domains:write"],
    "expiresAt": "2026-12-31T23:59:59Z"
  }'
```

### Response

```json
{
  "message": "API key created successfully",
  "warning": "Store this API key securely. It will not be shown again.",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "apiKey": "dmk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "keyPrefix": "dmk_a1b2c3d4",
    "name": "Payment Gateway Integration",
    "permissions": ["domains:read", "domains:write"],
    "description": "Used by payment gateway to verify domains",
    "expiresAt": "2026-12-31T23:59:59.000Z",
    "createdAt": "2026-01-22T10:30:00.000Z"
  }
}
```

**Important**: The `apiKey` value is only returned once. Store it securely!

---

## Using API Keys

### Which Endpoints Support API Keys?

API keys can be used with specific endpoints depending on the authentication strategy:

#### ✅ API Key ONLY Endpoints

These endpoints **require** API key authentication (no JWT support):

| Endpoint | Method | Description |
|----------|--------|-------------|
| Currently none | - | All API key management endpoints require JWT (superadmin) |

#### ✅ Flexible Authentication Endpoints

These endpoints support **both** JWT Bearer tokens AND API keys:

| Endpoint | Method | Description | Access Level |
|----------|--------|-------------|--------------|
| `/api/v1/auth/generate-user-token` | POST | Generate JWT token for any user | System-level (API Key) or Superadmin (JWT) |

#### ❌ JWT-Only Endpoints

These endpoints **do NOT** support API keys (JWT Bearer token required):

| Category | Endpoints | Why JWT Only? |
|----------|-----------|---------------|
| **User Management** | `/api/v1/auth/login`, `/api/v1/auth/logout`, `/api/v1/auth/register`, `/api/v1/auth/refresh`, `/api/v1/auth/change-password` | User identity required |
| **User Profile** | `/api/v1/users/me` (GET, PATCH) | User context required |
| **Domain Operations** | `/api/v1/domains/*` (all CRUD operations) | User ownership/tenant isolation |
| **API Key Management** | `/api/v1/admin/api-keys/*` (create, list, update, revoke, delete) | Superadmin JWT required for security |
| **Provider Management** | `/api/v1/admin/providers/*` | Superadmin JWT required |

### Authentication Method 1: X-API-Key Header

Use the `X-API-Key` header for endpoints that support API key authentication:

```bash
# Example: Generate user token using API key
curl -X POST https://your-domain.com/api/v1/auth/generate-user-token \
  -H "X-API-Key: dmk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-uuid-here"}'
```

### Authentication Method 2: Flexible Authentication

Endpoints marked as "Flexible" will try Bearer token first, then API key:

```bash
# Option A: Using Bearer token (superadmin JWT)
curl -X POST https://your-domain.com/api/v1/auth/generate-user-token \
  -H "Authorization: Bearer <superadmin_jwt>" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-uuid-here"}'

# Option B: Using API key (system-level access)
curl -X POST https://your-domain.com/api/v1/auth/generate-user-token \
  -H "X-API-Key: dmk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" \
  -H "Content-Type: application/json" \
  -d '{"userId": "user-uuid-here"}'
```

**Note**: Most endpoints currently require JWT for user context and tenant isolation. API keys are primarily used for system-level operations like token generation.

---

## Managing API Keys

### List All API Keys

```bash
curl -X GET https://your-domain.com/api/v1/admin/api-keys \
  -H "Authorization: Bearer <superadmin_token>"

# Include revoked keys
curl -X GET https://your-domain.com/api/v1/admin/api-keys?includeRevoked=true \
  -H "Authorization: Bearer <superadmin_token>"
```

### Get API Key Details

```bash
curl -X GET https://your-domain.com/api/v1/admin/api-keys/{id} \
  -H "Authorization: Bearer <superadmin_token>"
```

### Update API Key

```bash
curl -X PATCH https://your-domain.com/api/v1/admin/api-keys/{id} \
  -H "Authorization: Bearer <superadmin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Name",
    "description": "Updated description",
    "permissions": ["domains:read"],
    "expiresAt": "2027-12-31T23:59:59Z"
  }'
```

### Revoke API Key (Soft Delete)

```bash
curl -X POST https://your-domain.com/api/v1/admin/api-keys/{id}/revoke \
  -H "Authorization: Bearer <superadmin_token>"
```

Revoked keys remain in the database for audit purposes but cannot be used for authentication.

### Delete API Key (Hard Delete)

```bash
curl -X DELETE https://your-domain.com/api/v1/admin/api-keys/{id} \
  -H "Authorization: Bearer <superadmin_token>"
```

Permanently removes the API key from the database.

---

## Advanced Use Cases

### Generate User Tokens via API Key

API keys can be used to generate JWT tokens for users. This is useful for:
- External systems that need to authenticate users programmatically
- Integration flows where an external service needs user-level access
- Automated testing and provisioning

```bash
# Generate a JWT token for a specific user using an API key
curl -X POST https://your-domain.com/api/v1/auth/generate-user-token \
  -H "X-API-Key: dmk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "123e4567-e89b-12d3-a456-426614174000"
  }'

# Response:
{
  "message": "Token generated successfully",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900,
    "user": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "email": "user@example.com",
      "role": "merchant",
      "name": "John Doe"
    }
  }
}
```

**Use Case Example**: A payment gateway needs to generate tokens for merchants to access their domain monitoring dashboard:

```javascript
// Payment gateway backend
const axios = require('axios');

async function generateMerchantToken(merchantUserId) {
  const response = await axios.post(
    'https://your-domain.com/api/v1/auth/generate-user-token',
    { userId: merchantUserId },
    {
      headers: {
        'X-API-Key': process.env.DOMAIN_MONITOR_API_KEY,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data.data.accessToken;
}

// Later, pass this token to the merchant's frontend
const token = await generateMerchantToken('user-uuid-here');
// Frontend can now use this token to access domain monitoring APIs
```

---

## Permissions System

The permissions array is currently informational and can be used for:

- **Documentation**: Describe what the key is allowed to do
- **Future enforcement**: Implement granular access control
- **Audit trail**: Track intended usage

Example permission scopes:
- `domains:read` - Read domain information
- `domains:write` - Create/update domains
- `domains:delete` - Delete domains
- `webhooks:receive` - Receive webhook notifications
- `admin:read` - Read admin-level data

---

## Security Best Practices

### For API Key Creation

1. **Use descriptive names**: "Production Payment Gateway" not "key1"
2. **Add descriptions**: Document purpose and owner
3. **Set expiration dates**: Use `expiresAt` for temporary keys
4. **Limit permissions**: Only grant necessary scopes
5. **One key per integration**: Don't share keys across systems

### For API Key Storage

1. **Never commit to version control**: Add `*.key` and `.env*` to `.gitignore`
2. **Use environment variables**: Store in `.env` or secrets manager
3. **Rotate regularly**: Create new keys periodically
4. **Revoke on compromise**: Immediately revoke if leaked
5. **Monitor usage**: Check `lastUsedAt` for suspicious activity

### For API Key Usage

1. **Use HTTPS only**: Never send API keys over HTTP
2. **Don't log keys**: Mask in logs (`dmk_****`)
3. **Handle errors securely**: Don't expose key validation details
4. **Rate limit**: Implement rate limiting on API key endpoints
5. **Monitor failed attempts**: Alert on repeated authentication failures

---

## Database Migration

To enable API key authentication, run the migration:

```bash
# Apply migration
mysql -u your_user -p your_database < migrations/007_add_api_keys.sql
```

This creates the `api_keys` table with proper indexes and foreign keys.

---

## Implementation in Code

### Using API Key Middleware

```javascript
const { authenticateApiKey } = require('../middlewares/auth');

// Require API key authentication
router.get('/webhook-endpoint', authenticateApiKey, webhookController.handle);

// Flexible authentication (JWT or API key)
const { authenticateFlexible } = require('../middlewares/auth');
router.get('/domains', authenticateFlexible, domainController.list);
```

### Accessing API Key Info in Controllers

```javascript
async function myController(req, res, next) {
  // API key info is attached to req.apiKey
  console.log(req.apiKey.id);          // API key UUID
  console.log(req.apiKey.name);        // API key name
  console.log(req.apiKey.permissions); // Permission array

  // If associated with a user
  console.log(req.apiKeyUserId);       // User UUID (optional)
}
```

---

## Troubleshooting

### Invalid API Key

**Error**: `Invalid API key`

**Causes**:
- Wrong key format (must start with `dmk_`)
- Key not found in database
- Key hash doesn't match

**Solution**: Verify the key is correct and hasn't been deleted.

### API Key Expired

**Error**: `API key has expired`

**Cause**: The `expiresAt` date has passed

**Solution**: Create a new API key or update the expiration date.

### API Key Revoked

**Error**: `API key has been revoked`

**Cause**: The key was revoked via `/revoke` endpoint

**Solution**: Create a new API key (revoked keys cannot be un-revoked).

### Missing X-API-Key Header

**Error**: `Missing X-API-Key header`

**Cause**: The `X-API-Key` header is not present in the request

**Solution**: Add the header to your request.

---

## Examples

### Node.js (axios)

```javascript
const axios = require('axios');

const client = axios.create({
  baseURL: 'https://your-domain.com/api/v1',
  headers: {
    'X-API-Key': process.env.DOMAIN_MONITOR_API_KEY
  }
});

// Use the client
const domains = await client.get('/domains');
```

### Python (requests)

```python
import os
import requests

API_KEY = os.getenv('DOMAIN_MONITOR_API_KEY')
BASE_URL = 'https://your-domain.com/api/v1'

headers = {'X-API-Key': API_KEY}
response = requests.get(f'{BASE_URL}/domains', headers=headers)
domains = response.json()
```

### cURL

```bash
export API_KEY="dmk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"

curl -X GET https://your-domain.com/api/v1/domains \
  -H "X-API-Key: $API_KEY"
```

---

## API Reference

See [swagger.yaml](./swagger.yaml) for complete API documentation with request/response schemas.

Key endpoints:
- `POST /api/v1/admin/api-keys` - Create API key
- `GET /api/v1/admin/api-keys` - List API keys
- `GET /api/v1/admin/api-keys/{id}` - Get API key details
- `PATCH /api/v1/admin/api-keys/{id}` - Update API key
- `POST /api/v1/admin/api-keys/{id}/revoke` - Revoke API key
- `DELETE /api/v1/admin/api-keys/{id}` - Delete API key

---

## Support

For issues or questions:
1. Check the logs for detailed error messages
2. Verify API key format and validity
3. Review the Swagger documentation
4. Contact your system administrator
