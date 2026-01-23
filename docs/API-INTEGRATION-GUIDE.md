# Domain Monitor API Integration Guide

## Overview

The Domain Monitor API enables you to monitor merchant web presence and receive real-time recommendations about domain trustworthiness. This guide covers everything you need to integrate the API into your application.

### Base URLs

| Environment | URL |
|-------------|-----|
| Development | `https://dev-domainmonitor.ipo-servers.net` |
| UAT | `` |
| Production | `` |

### API Version

All endpoints are versioned under `/api/v1/`.

---

## Authentication

The API uses JWT (JSON Web Token) bearer authentication. All protected endpoints require the `Authorization` header.

### Getting Started

#### 1. Register a User

```bash
curl -X POST https://dev-domainmonitor.ipo-servers.net/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123",
    "name": "John Doe"
  }'
```

**Response:**
```json
{
  "message": "Registration successful",
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "merchant"
  }
}
```

#### 2. Login to Get Tokens

```bash
curl -X POST https://dev-domainmonitor.ipo-servers.net/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123"
  }'
```

**Response:**
```json
{
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "expiresIn": 900
  }
}
```

#### 3. Using the Access Token

Include the token in all authenticated requests:

```bash
curl -X GET https://dev-domainmonitor.ipo-servers.net/api/v1/domains \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### Token Refresh

Access tokens expire after 15 minutes. Use the refresh token to get a new access token:

```bash
curl -X POST https://dev-domainmonitor.ipo-servers.net/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  }'
```

### Password Management

#### Change Password

```bash
curl -X POST https://dev-domainmonitor.ipo-servers.net/api/v1/auth/change-password \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "OldPass123",
    "newPassword": "NewSecurePass456"
  }'
```

#### Forgot Password

```bash
curl -X POST https://dev-domainmonitor.ipo-servers.net/api/v1/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

---

## User Roles

The API supports three user roles with different access levels:

| Role | Description | Capabilities |
|------|-------------|--------------|
| `merchant` | Standard user | Manage own domains only |
| `reseller` | Partner account | Manage domains for assigned merchants |
| `superadmin` | Administrator | Full system access, manage all domains and providers |

---

## Domain Monitoring

### Adding a Domain

Add a single domain or business for monitoring.

```bash
curl -X POST https://dev-domainmonitor.ipo-servers.net/api/v1/domains \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "example.com",
    "checkFrequency": "daily"
  }'
```

**Response:**
```json
{
  "message": "Domain added successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "domain": "example.com",
    "name": null,
    "status": "active",
    "recommendation": null,
    "industry": null,
    "businessType": null,
    "foundedYear": null,
    "provider": null,
    "checkFrequency": "daily",
    "lastCheckedAt": null,
    "nextCheckAt": "2024-01-16T10:00:00.000Z",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
}
```

### Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `domain` | string | Either domain or name | Domain name (e.g., "example.com") |
| `name` | string | Either domain or name | Business name for company search |
| `description` | string | No | Business description |
| `website` | string | No | Full website URL |
| `addressLine1` | string | No | Street address |
| `addressLine2` | string | No | Additional address info |
| `city` | string | No | City |
| `stateProvince` | string | No | State or province |
| `postalCode` | string | No | Postal/ZIP code |
| `country` | string | No | Country |
| `email` | string | No | Contact email |
| `phone` | string | No | Contact phone |
| `fullName` | string | No | Contact person name |
| `externalTrackingRef` | string | No | Your external reference ID |
| `checkFrequency` | string | No | `7`, `30`, or `90` (days) |

{% hint style="info" %}
**One-Time Check vs Monitoring**

- If `checkFrequency` is provided, the domain will be monitored continuously
- If `checkFrequency` is omitted or null, only a one-time check is performed (no ongoing monitoring)
{% endhint %}

{% hint style="warning" %}
**Asynchronous Processing**

Domain checks are processed **asynchronously**. The `POST /domains` response returns immediately with `recommendation: null`. You must poll to get results. See [Getting Check Results](#getting-check-results-polling) below.
{% endhint %}

### Adding a Business by Name

You can search for a business without a domain:

```bash
curl -X POST https://dev-domainmonitor.ipo-servers.net/api/v1/domains \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corporation",
    "city": "San Francisco",
    "stateProvince": "CA",
    "country": "USA"
  }'
```

{% hint style="warning" %}
**Business Name Only Searches**

When adding a business by name only (without domain), ongoing monitoring cannot be started. Only a one-time company search is performed regardless of the `checkFrequency` setting.
{% endhint %}

### Adding Domains in Bulk

Add up to 100 domains in a single request:

```bash
curl -X POST https://dev-domainmonitor.ipo-servers.net/api/v1/domains/bulk \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "domains": [
      {
        "domain": "example1.com",
        "checkFrequency": "daily"
      },
      {
        "domain": "example2.com",
        "name": "Example Two Inc",
        "checkFrequency": "weekly"
      },
      {
        "name": "Business Without Domain",
        "city": "New York"
      }
    ]
  }'
```

**Response:**
```json
{
  "success": [
    {
      "id": "uuid-1",
      "domain": "example1.com",
      "status": "active"
    },
    {
      "id": "uuid-2",
      "domain": "example2.com",
      "name": "Example Two Inc",
      "status": "active"
    }
  ],
  "failed": [
    {
      "domain": "Business Without Domain",
      "error": "Domain already exists"
    }
  ],
  "total": 3,
  "successCount": 2,
  "failedCount": 1,
  "providerChecks": {
    "checked": 2,
    "failed": 0,
    "failures": []
  }
}
```

---

## Getting Check Results (Polling)

Since domain checks are processed asynchronously, the initial `POST /domains` response returns with `recommendation: null`. You need to poll the API to get the actual results.

### Integration Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Client Integration Flow                          │
└─────────────────────────────────────────────────────────────────────────┘

    ┌──────────┐         ┌──────────────┐         ┌──────────────────┐
    │  Client  │         │  Domain API  │         │  Provider (Async) │
    └────┬─────┘         └──────┬───────┘         └────────┬─────────┘
         │                      │                          │
         │  POST /domains       │                          │
         │─────────────────────>│                          │
         │                      │                          │
         │  201 Created         │   Check domain (async)   │
         │  recommendation:null │─────────────────────────>│
         │<─────────────────────│                          │
         │                      │                          │
         │  (wait 2s)           │                          │
         │                      │                          │
         │  GET /domains/{id}   │                          │
         │─────────────────────>│                          │
         │                      │                          │
         │  recommendation:null │                          │
         │<─────────────────────│                          │
         │                      │      Result ready        │
         │  (wait 3s)           │<─────────────────────────│
         │                      │                          │
         │  GET /domains/{id}   │                          │
         │─────────────────────>│                          │
         │                      │                          │
         │  recommendation:pass │                          │
         │<─────────────────────│                          │
         │                      │                          │
    ┌────┴─────┐         ┌──────┴───────┐         ┌────────┴─────────┐
    │  Client  │         │  Domain API  │         │  Provider (Async) │
    └──────────┘         └──────────────┘         └──────────────────┘
```

### Recommended Integration Pattern

```
1. POST /domains → Returns domain with recommendation: null
2. Poll GET /domains/{id} until recommendation is not null
3. Process the result (pass/fail/review)
```

### Polling Strategy

#### Simple Polling

Poll at fixed intervals until you get a result:

```javascript
async function addDomainAndWaitForResult(domainData, maxAttempts = 10, delayMs = 2000) {
  // 1. Add the domain
  const response = await axios.post(`${API_BASE}/domains`, domainData, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const domainId = response.data.data.id;
  console.log(`Domain added: ${domainId}, waiting for check result...`);

  // 2. Poll for result
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await sleep(delayMs);

    const domain = await axios.get(`${API_BASE}/domains/${domainId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (domain.data.data.recommendation !== null) {
      console.log(`Check complete: ${domain.data.data.recommendation}`);
      return domain.data.data;
    }

    console.log(`Attempt ${attempt}/${maxAttempts}: still processing...`);
  }

  throw new Error('Timeout waiting for domain check result');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

#### Exponential Backoff (Recommended)

More efficient polling with increasing delays:

```javascript
async function addDomainWithBackoff(domainData) {
  const response = await axios.post(`${API_BASE}/domains`, domainData, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const domainId = response.data.data.id;

  // Exponential backoff: 1s, 2s, 4s, 8s, 16s (max 5 attempts = 31s total)
  const maxAttempts = 5;
  let delay = 1000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await sleep(delay);

    const domain = await axios.get(`${API_BASE}/domains/${domainId}`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (domain.data.data.recommendation !== null) {
      return domain.data.data;
    }

    delay *= 2; // Double the delay each attempt
  }

  // Return domain even if check not complete (handle in business logic)
  return (await axios.get(`${API_BASE}/domains/${domainId}`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })).data.data;
}
```

### Bulk Operations: Efficient Polling

For bulk domain additions, poll all domains in a single list request:

```javascript
async function addDomainsAndWaitForResults(domainsData) {
  // 1. Add domains in bulk
  const response = await axios.post(`${API_BASE}/domains/bulk`, {
    domains: domainsData
  }, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  const domainIds = response.data.success.map(d => d.id);
  console.log(`Added ${domainIds.length} domains, waiting for checks...`);

  // 2. Poll using list endpoint with IDs
  const maxAttempts = 10;
  let delay = 2000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await sleep(delay);

    // Get all domains in one request
    const result = await axios.post(`${API_BASE}/domains/bulk/retrieve`, {
      ids: domainIds
    }, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const domains = result.data.domains;
    const pending = domains.filter(d => d.recommendation === null);
    const complete = domains.filter(d => d.recommendation !== null);

    console.log(`Attempt ${attempt}: ${complete.length}/${domains.length} complete`);

    if (pending.length === 0) {
      return domains; // All done
    }

    delay = Math.min(delay * 1.5, 10000); // Increase delay, max 10s
  }

  // Return whatever we have
  return (await axios.post(`${API_BASE}/domains/bulk/retrieve`, {
    ids: domainIds
  }, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })).data.domains;
}
```

### Typical Processing Times

| Scenario | Typical Time |
|----------|-------------|
| Domain with existing data | 2-5 seconds |
| New domain lookup | 5-15 seconds |
| Business name search | 5-20 seconds |
| Provider timeout/retry | Up to 30 seconds |

{% hint style="info" %}
**Recommended Polling Configuration**

- **Initial delay:** 2 seconds (provider needs time to process)
- **Max attempts:** 10-15 attempts
- **Strategy:** Exponential backoff starting at 2s
- **Total timeout:** 30-60 seconds max
{% endhint %}

### Handling Pending Results

If a check is still pending after your timeout, you have options:

1. **Store and check later:** Save the domain ID and check again later
2. **Show pending status:** Display "Processing" to users
3. **Use webhooks:** (Coming soon) Get notified when check completes

```javascript
async function handleDomainResult(domain) {
  switch (domain.recommendation) {
    case 'pass':
      return { status: 'approved', action: 'proceed' };
    case 'fail':
      return { status: 'rejected', action: 'block' };
    case 'review':
      return { status: 'pending_review', action: 'manual_check' };
    case null:
      return { status: 'processing', action: 'retry_later' };
    default:
      return { status: 'unknown', action: 'manual_check' };
  }
}
```

---

## Retrieving Domain Data

### Get Single Domain

```bash
curl -X GET https://dev-domainmonitor.ipo-servers.net/api/v1/domains/{id} \
  -H "Authorization: Bearer <token>"
```

### Get Domain with Full Details

Includes raw provider response data:

```bash
curl -X GET https://dev-domainmonitor.ipo-servers.net/api/v1/domains/{id}/details \
  -H "Authorization: Bearer <token>"
```

**Response includes additional fields:**
```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "domain": "example.com",
    "recommendation": "pass",
    "rawData": {
      "name": "Example Corp",
      "recommendation": { "decision": "Pass" },
      "industry": { "primary_industry": "Technology" },
      "formation_type": "Corporation",
      "founded_year": 2015
    },
    "providerResponseId": "tracking-uuid-from-provider"
  }
}
```

### List All Domains

```bash
curl -X GET "https://dev-domainmonitor.ipo-servers.net/api/v1/domains?page=1&limit=20" \
  -H "Authorization: Bearer <token>"
```

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 20 | Items per page (max 100) |
| `status` | string | - | Filter: `active` or `inactive` |
| `recommendation` | string | - | Filter: `pass`, `fail`, or `review` |
| `search` | string | - | Search in domain and name |
| `sortBy` | string | `created_at` | Sort field |
| `sortOrder` | string | `desc` | `asc` or `desc` |

**Available sort fields:** `created_at`, `updated_at`, `domain`, `name`, `recommendation`, `last_checked_at`

**Response:**
```json
{
  "data": [
    {
      "id": "uuid-1",
      "domain": "example.com",
      "recommendation": "pass"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  },
  "filters": {
    "status": null,
    "recommendation": null,
    "search": null
  }
}
```

### Retrieve Multiple Domains by ID

```bash
curl -X POST https://dev-domainmonitor.ipo-servers.net/api/v1/domains/bulk/retrieve \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "ids": ["uuid-1", "uuid-2", "uuid-3"]
  }'
```

---

## Managing Monitoring

### Stop Monitoring

```bash
curl -X PATCH https://dev-domainmonitor.ipo-servers.net/api/v1/domains/{id}/stop \
  -H "Authorization: Bearer <token>"
```

### Start/Restart Monitoring

```bash
curl -X PATCH https://dev-domainmonitor.ipo-servers.net/api/v1/domains/{id}/start \
  -H "Authorization: Bearer <token>"
```

### Bulk Stop Monitoring

```bash
curl -X PATCH https://dev-domainmonitor.ipo-servers.net/api/v1/domains/bulk/stop \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "ids": ["uuid-1", "uuid-2", "uuid-3"]
  }'
```

### Bulk Start Monitoring

```bash
curl -X PATCH https://dev-domainmonitor.ipo-servers.net/api/v1/domains/bulk/start \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "ids": ["uuid-1", "uuid-2", "uuid-3"]
  }'
```

---

## Check History

View the history of checks for a domain:

```bash
curl -X GET "https://dev-domainmonitor.ipo-servers.net/api/v1/domains/{id}/history?limit=10" \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "data": [
    {
      "id": "history-uuid-1",
      "recommendation": "pass",
      "provider": "truebiz",
      "checkedAt": "2024-01-15T10:00:00.000Z"
    },
    {
      "id": "history-uuid-2",
      "recommendation": "review",
      "provider": "truebiz",
      "checkedAt": "2024-01-14T10:00:00.000Z"
    }
  ]
}
```

---

## Recommendations

The API returns one of three recommendation values:

| Value | Description | Suggested Action |
|-------|-------------|------------------|
| `pass` | Domain/business is verified and trustworthy | Proceed with transaction |
| `review` | Requires manual review | Additional verification needed |
| `fail` | Domain/business failed verification | Block or reject |

---

## Multi-Tenant Features

### Superadmin/Reseller: Add Domain for Merchant

Superadmins and resellers can add domains on behalf of merchants:

```bash
curl -X POST https://dev-domainmonitor.ipo-servers.net/api/v1/domains \
  -H "Authorization: Bearer <superadmin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "merchant-domain.com",
    "checkFrequency": "daily",
    "merchantId": "merchant-user-uuid"
  }'
```

The `merchantId` field is only available to superadmin and reseller roles.

---

## Error Handling

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "domain",
        "message": "Please provide a valid domain name"
      }
    ]
  }
}
```

### Common Error Codes

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid request body |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `DOMAIN_NOT_FOUND` | Domain does not exist |
| 409 | `DOMAIN_EXISTS` | Domain already being monitored |
| 422 | `UNPROCESSABLE_ENTITY` | Business logic error |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

### Rate Limiting

The API implements rate limiting to ensure fair usage:

- **Standard limit:** 100 requests per minute per user
- **Bulk operations:** Count as single request
- **Rate limit headers:**
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

---

## Code Examples

### Node.js

```javascript
const axios = require('axios');

const API_BASE = 'https://dev-domainmonitor.ipo-servers.net/api/v1';
let accessToken = null;

// Helper: sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Login
async function login(email, password) {
  const response = await axios.post(`${API_BASE}/auth/login`, {
    email,
    password
  });
  accessToken = response.data.data.accessToken;
  return response.data;
}

// Get domain by ID
async function getDomain(domainId) {
  const response = await axios.get(
    `${API_BASE}/domains/${domainId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return response.data.data;
}

// Add domain and wait for check result (recommended pattern)
async function addDomainAndWait(domainData, options = {}) {
  const { maxAttempts = 10, initialDelay = 2000 } = options;

  // 1. Add the domain
  const response = await axios.post(
    `${API_BASE}/domains`,
    domainData,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const domainId = response.data.data.id;
  console.log(`Domain added: ${domainId}`);

  // 2. Poll for result with exponential backoff
  let delay = initialDelay;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await sleep(delay);

    const domain = await getDomain(domainId);

    if (domain.recommendation !== null) {
      console.log(`Check complete: ${domain.recommendation}`);
      return domain;
    }

    console.log(`Attempt ${attempt}/${maxAttempts}: processing...`);
    delay = Math.min(delay * 1.5, 10000); // Max 10s between polls
  }

  // Return current state even if still pending
  console.log('Timeout - returning current state');
  return await getDomain(domainId);
}

// Add domain without waiting (fire and forget)
async function addDomain(domainData) {
  const response = await axios.post(
    `${API_BASE}/domains`,
    domainData,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return response.data.data;
}

// List domains with filtering
async function listDomains(filters = {}) {
  const params = new URLSearchParams(filters);
  const response = await axios.get(
    `${API_BASE}/domains?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return response.data;
}

// Usage
(async () => {
  await login('user@example.com', 'SecurePass123');

  // RECOMMENDED: Add domain and wait for result
  const result = await addDomainAndWait({
    domain: 'newdomain.com',
    checkFrequency: 'daily'
  });
  console.log('Recommendation:', result.recommendation);
  console.log('Industry:', result.industry);
  console.log('Business Type:', result.businessType);

  // One-time check (no monitoring)
  const oneTimeResult = await addDomainAndWait({
    domain: 'check-only.com'
    // No checkFrequency = one-time check only
  });
  console.log('One-time check result:', oneTimeResult.recommendation);

  // Fire and forget (check result later)
  const pending = await addDomain({ domain: 'later-check.com' });
  console.log('Added (pending):', pending.id);
  // ... check result later with getDomain(pending.id)

  // List failed domains
  const failedDomains = await listDomains({ recommendation: 'fail' });
  console.log('Failed domains:', failedDomains.data.length);
})();
```

### Python

```python
import requests
import time

API_BASE = 'https://dev-domainmonitor.ipo-servers.net/api/v1'

class DomainMonitorClient:
    def __init__(self):
        self.access_token = None

    def login(self, email, password):
        response = requests.post(
            f'{API_BASE}/auth/login',
            json={'email': email, 'password': password}
        )
        response.raise_for_status()
        data = response.json()
        self.access_token = data['data']['accessToken']
        return data

    def _headers(self):
        return {'Authorization': f'Bearer {self.access_token}'}

    def get_domain(self, domain_id, include_details=False):
        endpoint = f'/domains/{domain_id}'
        if include_details:
            endpoint += '/details'

        response = requests.get(
            f'{API_BASE}{endpoint}',
            headers=self._headers()
        )
        response.raise_for_status()
        return response.json()['data']

    def add_domain(self, domain=None, name=None, check_frequency='daily', **kwargs):
        """Add domain without waiting for result."""
        payload = {k: v for k, v in {
            'domain': domain,
            'name': name,
            'checkFrequency': check_frequency,
            **kwargs
        }.items() if v is not None}

        response = requests.post(
            f'{API_BASE}/domains',
            json=payload,
            headers=self._headers()
        )
        response.raise_for_status()
        return response.json()['data']

    def add_domain_and_wait(self, domain=None, name=None, check_frequency='daily',
                            max_attempts=10, initial_delay=2.0, **kwargs):
        """Add domain and poll until check result is available (recommended)."""
        # 1. Add the domain
        domain_data = self.add_domain(
            domain=domain,
            name=name,
            check_frequency=check_frequency,
            **kwargs
        )
        domain_id = domain_data['id']
        print(f"Domain added: {domain_id}")

        # 2. Poll for result with exponential backoff
        delay = initial_delay
        for attempt in range(1, max_attempts + 1):
            time.sleep(delay)

            result = self.get_domain(domain_id)

            if result['recommendation'] is not None:
                print(f"Check complete: {result['recommendation']}")
                return result

            print(f"Attempt {attempt}/{max_attempts}: processing...")
            delay = min(delay * 1.5, 10.0)  # Max 10s between polls

        # Return current state even if still pending
        print("Timeout - returning current state")
        return self.get_domain(domain_id)

    def list_domains(self, **filters):
        response = requests.get(
            f'{API_BASE}/domains',
            params=filters,
            headers=self._headers()
        )
        response.raise_for_status()
        return response.json()

# Usage
client = DomainMonitorClient()
client.login('user@example.com', 'SecurePass123')

# RECOMMENDED: Add domain and wait for result
result = client.add_domain_and_wait(domain='example.com', check_frequency='daily')
print(f"Recommendation: {result['recommendation']}")
print(f"Industry: {result['industry']}")
print(f"Business Type: {result['businessType']}")

# One-time company search (no monitoring), wait for result
result = client.add_domain_and_wait(
    name='Acme Corp',
    city='San Francisco',
    check_frequency=None  # No monitoring
)
print(f"Company search result: {result['recommendation']}")

# Fire and forget (check result later)
pending = client.add_domain(domain='later-check.com')
print(f"Added (pending): {pending['id']}")
# ... check result later with client.get_domain(pending['id'])

# Get domains needing review
review_domains = client.list_domains(recommendation='review')
for domain in review_domains['data']:
    print(f"Review needed: {domain['domain']}")
```

### PHP

```php
<?php

class DomainMonitorClient {
    private $baseUrl = 'https://dev-domainmonitor.ipo-servers.net/api/v1';
    private $accessToken;

    public function login($email, $password) {
        $response = $this->request('POST', '/auth/login', [
            'email' => $email,
            'password' => $password
        ]);
        $this->accessToken = $response['data']['accessToken'];
        return $response;
    }

    public function getDomain($id, $includeDetails = false) {
        $endpoint = "/domains/{$id}";
        if ($includeDetails) {
            $endpoint .= '/details';
        }
        $response = $this->request('GET', $endpoint, null, true);
        return $response['data'];
    }

    public function addDomain($domainData) {
        $response = $this->request('POST', '/domains', $domainData, true);
        return $response['data'];
    }

    /**
     * Add domain and wait for check result (recommended pattern)
     */
    public function addDomainAndWait($domainData, $maxAttempts = 10, $initialDelay = 2) {
        // 1. Add the domain
        $domain = $this->addDomain($domainData);
        $domainId = $domain['id'];
        echo "Domain added: {$domainId}\n";

        // 2. Poll for result with exponential backoff
        $delay = $initialDelay;
        for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
            sleep($delay);

            $result = $this->getDomain($domainId);

            if ($result['recommendation'] !== null) {
                echo "Check complete: {$result['recommendation']}\n";
                return $result;
            }

            echo "Attempt {$attempt}/{$maxAttempts}: processing...\n";
            $delay = min($delay * 1.5, 10); // Max 10s between polls
        }

        // Return current state even if still pending
        echo "Timeout - returning current state\n";
        return $this->getDomain($domainId);
    }

    public function listDomains($filters = []) {
        $query = http_build_query($filters);
        return $this->request('GET', "/domains?{$query}", null, true);
    }

    private function request($method, $endpoint, $data = null, $auth = false) {
        $ch = curl_init($this->baseUrl . $endpoint);

        $headers = ['Content-Type: application/json'];
        if ($auth && $this->accessToken) {
            $headers[] = "Authorization: Bearer {$this->accessToken}";
        }

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_CUSTOMREQUEST => $method
        ]);

        if ($data && in_array($method, ['POST', 'PATCH', 'PUT'])) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }

        $response = curl_exec($ch);
        curl_close($ch);

        return json_decode($response, true);
    }
}

// Usage
$client = new DomainMonitorClient();
$client->login('user@example.com', 'SecurePass123');

// RECOMMENDED: Add domain and wait for result
$result = $client->addDomainAndWait([
    'domain' => 'example.com',
    'checkFrequency' => 'daily'
]);
echo "Recommendation: {$result['recommendation']}\n";
echo "Industry: {$result['industry']}\n";
echo "Business Type: {$result['businessType']}\n";

// One-time check (no monitoring), wait for result
$result = $client->addDomainAndWait([
    'domain' => 'check-only.com'
    // No checkFrequency = one-time check only
]);
echo "One-time result: {$result['recommendation']}\n";

// Fire and forget (check result later)
$pending = $client->addDomain(['domain' => 'later-check.com']);
echo "Added (pending): {$pending['id']}\n";
// ... check result later with $client->getDomain($pending['id'])

// List all failed domains
$failed = $client->listDomains(['recommendation' => 'fail']);
foreach ($failed['data'] as $domain) {
    echo "Failed: {$domain['domain']}\n";
}
```

---

## Health Check

Monitor API availability:

```bash
curl -X GET https://dev-domainmonitor.ipo-servers.net/health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:00:00.000Z",
  "checks": {
    "database": "ok"
  }
}
```

---

## Best Practices

### 1. Token Management

- Store tokens securely (never in localStorage for web apps)
- Implement automatic token refresh before expiration
- Clear tokens on logout

### 2. Error Handling

- Always check HTTP status codes
- Parse error responses for detailed messages
- Implement exponential backoff for retries

### 3. Bulk Operations

- Use bulk endpoints for multiple operations
- Maximum 100 items per bulk request
- Process results to handle partial failures

### 4. Monitoring Strategy

| Use Case | Recommended Frequency |
|----------|----------------------|
| High-risk merchants | `daily` |
| Standard merchants | `weekly` |
| Low-risk/established | `monthly` |
| One-time verification | `null` (no frequency) |

### 5. Pagination

- Always paginate large result sets
- Use reasonable page sizes (20-50 items)
- Implement cursor-based pagination for real-time updates

---

## API Reference

For the complete OpenAPI specification, see:

- **Swagger UI:** `https://dev-domainmonitor.ipo-servers.net/api/docs`
- **OpenAPI JSON:** `https://dev-domainmonitor.ipo-servers.net/api/docs/swagger.json`

---

## Support

For API support or to report issues:

- **Documentation:** [GitBook](https://docs.domainmonitor.example.com)
- **API Status:** [Status Page](https://status.domainmonitor.example.com)
- **Email:** api-support@example.com
