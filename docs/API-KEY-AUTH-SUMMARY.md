# API Key Authentication - Route Summary

## Overview
API keys can now be used to authenticate to most API endpoints, providing machine-to-machine access without requiring JWT tokens.

## Authentication Methods by Endpoint

### ✅ API Key Supported (Flexible Authentication)

These endpoints accept **either** JWT Bearer token OR API key (`X-API-Key` header):

#### Domain Operations
- **POST** `/api/v1/domains` - Create domain
- **GET** `/api/v1/domains` - List domains
- **GET** `/api/v1/domains/:id` - Get domain
- **GET** `/api/v1/domains/:id/details` - Get domain details
- **GET** `/api/v1/domains/:id/history` - Get check history
- **PATCH** `/api/v1/domains/:id/start` - Start monitoring
- **PATCH** `/api/v1/domains/:id/stop` - Stop monitoring
- **POST** `/api/v1/domains/bulk` - Bulk create domains
- **POST** `/api/v1/domains/bulk/retrieve` - Bulk retrieve domains
- **PATCH** `/api/v1/domains/bulk/start` - Bulk start monitoring
- **PATCH** `/api/v1/domains/bulk/stop` - Bulk stop monitoring

#### User Webhooks
- **POST** `/api/v1/user-webhooks` - Create webhook endpoint
- **GET** `/api/v1/user-webhooks` - List webhook endpoints
- **GET** `/api/v1/user-webhooks/:id` - Get webhook endpoint
- **PATCH** `/api/v1/user-webhooks/:id` - Update webhook endpoint
- **DELETE** `/api/v1/user-webhooks/:id` - Delete webhook endpoint
- **POST** `/api/v1/user-webhooks/:id/regenerate-secret` - Regenerate secret
- **POST** `/api/v1/user-webhooks/:id/test` - Test webhook
- **GET** `/api/v1/user-webhooks/:id/deliveries` - Get delivery logs

#### Admin - Providers (Superadmin or API Key)
- **GET** `/api/v1/admin/providers` - List providers
- **POST** `/api/v1/admin/providers` - Create provider
- **POST** `/api/v1/admin/providers/reload` - Reload providers
- **GET** `/api/v1/admin/providers/:id` - Get provider
- **GET** `/api/v1/admin/providers/name/:name` - Get provider by name
- **PATCH** `/api/v1/admin/providers/:id` - Update provider
- **PATCH** `/api/v1/admin/providers/:id/enable` - Enable provider
- **PATCH** `/api/v1/admin/providers/:id/disable` - Disable provider
- **PATCH** `/api/v1/admin/providers/:id/priority` - Update priority
- **DELETE** `/api/v1/admin/providers/:id` - Delete provider
- **GET** `/api/v1/admin/providers/:id/health` - Check health

#### Admin - API Keys (Superadmin or API Key)
- **POST** `/api/v1/admin/api-keys` - Create API key
- **GET** `/api/v1/admin/api-keys` - List API keys
- **GET** `/api/v1/admin/api-keys/:id` - Get API key
- **PATCH** `/api/v1/admin/api-keys/:id` - Update API key
- **POST** `/api/v1/admin/api-keys/:id/revoke` - Revoke API key
- **DELETE** `/api/v1/admin/api-keys/:id` - Delete API key

#### Admin - Webhooks (Superadmin or API Key)
- **GET** `/api/v1/webhooks/:provider/events` - List webhook events
- **POST** `/api/v1/webhooks/events/:id/retry` - Retry webhook

### ❌ JWT Token Only (No API Key Support)

These endpoints **require JWT Bearer token** and do NOT accept API keys:

#### User Profile
- **GET** `/api/v1/users/me` - Get user profile
- **PATCH** `/api/v1/users/me` - Update user profile

#### Authentication (except generate-user-token)
- **POST** `/api/v1/auth/register` - User registration (public)
- **POST** `/api/v1/auth/login` - User login (public)
- **POST** `/api/v1/auth/refresh` - Refresh token (public)
- **POST** `/api/v1/auth/forgot-password` - Forgot password (public)
- **POST** `/api/v1/auth/reset-password` - Reset password (public)
- **POST** `/api/v1/auth/logout` - Logout (JWT only)
- **POST** `/api/v1/auth/change-password` - Change password (JWT only)

#### Special: Mixed Auth
- **POST** `/api/v1/auth/generate-user-token` - Generate user token (JWT OR API Key)

### 🌐 Public (No Authentication)
- **GET** `/health` - Health check
- **POST** `/api/v1/webhooks/:provider` - Receive provider webhooks

## Usage Examples

### Using JWT Bearer Token
```bash
curl -X GET https://api.domain.com/api/v1/domains \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

### Using API Key
```bash
curl -X GET https://api.domain.com/api/v1/domains \
  -H "X-API-Key: dmk_abc123def456..."
```

## Implementation Details

### Middleware Changes
1. **`authenticateFlexible`** - Tries JWT first, falls back to API key
2. **`requireSuperadminOrApiKey`** - Allows superadmin JWT or any valid API key

### Route Files Updated
- `src/routes/domains.js` - Changed from `authenticate` to `authenticateFlexible`
- `src/routes/providers.js` - Changed to `authenticateFlexible` + `requireSuperadminOrApiKey`
- `src/routes/apiKeyRoutes.js` - Changed to `authenticateFlexible` + `requireSuperadminOrApiKey`
- `src/routes/userWebhookRoutes.js` - Changed from `authenticate` to `authenticateFlexible`
- `src/routes/webhookRoutes.js` - Changed to `authenticateFlexible` + `requireSuperadminOrApiKey` for admin endpoints
- `src/routes/users.js` - **Unchanged** (remains JWT-only)
- `src/routes/auth.js` - **Unchanged** (already correct configuration)

## Security Considerations

1. **User-specific endpoints**: API keys provide system-level access. When using API keys on user-specific endpoints (like domains), ensure proper user context is handled.

2. **JWT remains preferred for user actions**: User profile and authentication changes still require JWT tokens for security.

3. **API key permissions**: All API keys have full system access. Future enhancements could add permission scoping.

4. **Rate limiting**: API keys should have appropriate rate limiting configured to prevent abuse.
