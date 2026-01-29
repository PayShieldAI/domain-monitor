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
| `search` | string | - | Search in domain and name (max 255 chars) |
| `industry` | string | - | Filter by industry (max 255 chars) |
| `businessType` | string | - | Filter by business type (max 255 chars) |
| `foundedYear` | integer | - | Filter by founded year (1800 - current year) |
| `sortBy` | string | `created_at` | Sort field |
| `sortOrder` | string | `desc` | `asc` or `desc` |

**Available sort fields:** `created_at`, `updated_at`, `domain`, `name`, `recommendation`, `last_checked_at`, `industry`, `business_type`, `founded_year`

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
    "search": null,
    "industry": null,
    "businessType": null,
    "foundedYear": null
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

## Webhooks

Webhooks allow you to receive real-time notifications when domain events occur, eliminating the need for polling. Instead of repeatedly checking for updates, the API will push events to your registered endpoint.

### Benefits of Webhooks

- **Real-time notifications:** Instant updates when domain checks complete
- **Reduced API calls:** No need to poll for results
- **Efficient:** Handle multiple domains without constant monitoring
- **Reliable:** Automatic retries on delivery failures

### Webhook Events

The following events can trigger webhook notifications:

| Event Type | Description |
|------------|-------------|
| `domain.created` | New domain registered for monitoring |
| `business-profile` | Domain business profile updated |
| `domain.deleted` | Domain removed from monitoring |
| `business-closed` | Business appears to be closed |
| `sentiment` | Negative sentiment detected |
| `website` | Website check completed |

### Registering a Webhook Endpoint

Create a webhook endpoint to start receiving notifications:

```bash
curl -X POST https://dev-domainmonitor.ipo-servers.net/api/v1/user-webhooks \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhooks/domain-monitor",
    "events": ["business-closed", "sentiment", "website"],
    "description": "Production webhook endpoint"
  }'
```

**Request Fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | string | Yes | HTTPS URL to receive webhook events (max 2048 chars) |
| `events` | array | No | Specific event types to subscribe to. Omit or set to `null` to receive all events |
| `description` | string | No | Human-readable description (max 500 chars) |

**Response:**
```json
{
  "message": "Webhook endpoint created successfully",
  "warning": "Store the secret securely. It will not be shown again.",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "url": "https://your-app.com/webhooks/domain-monitor",
    "events": ["business-closed", "sentiment", "website"],
    "description": "Production webhook endpoint",
    "enabled": true,
    "secret": "whsec_abc123def456...",
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
}
```

{% hint style="warning" %}
**Important:** The webhook signing secret is only shown once during creation. Store it securely - you'll need it to verify webhook signatures.
{% endhint %}

### Managing Webhook Endpoints

#### List All Webhooks

```bash
curl -X GET https://dev-domainmonitor.ipo-servers.net/api/v1/user-webhooks \
  -H "Authorization: Bearer <token>"
```

#### Get Webhook Details

```bash
curl -X GET https://dev-domainmonitor.ipo-servers.net/api/v1/user-webhooks/{id} \
  -H "Authorization: Bearer <token>"
```

#### Update Webhook

```bash
curl -X PATCH https://dev-domainmonitor.ipo-servers.net/api/v1/user-webhooks/{id} \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhooks/new-endpoint",
    "events": null,
    "enabled": true
  }'
```

#### Delete Webhook

```bash
curl -X DELETE https://dev-domainmonitor.ipo-servers.net/api/v1/user-webhooks/{id} \
  -H "Authorization: Bearer <token>"
```

#### Test Webhook

Send a test webhook to verify your endpoint is working:

```bash
curl -X POST https://dev-domainmonitor.ipo-servers.net/api/v1/user-webhooks/{id}/test \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "message": "Test webhook sent successfully",
  "data": {
    "status": "success",
    "responseStatus": 200,
    "durationMs": 245
  }
}
```

#### Regenerate Secret

If your webhook secret is compromised, regenerate it immediately:

```bash
curl -X POST https://dev-domainmonitor.ipo-servers.net/api/v1/user-webhooks/{id}/regenerate-secret \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "message": "Webhook secret regenerated successfully",
  "warning": "Store the new secret securely. It will not be shown again.",
  "data": {
    "secret": "whsec_new123..."
  }
}
```

---

### Webhook Security

All webhook requests include a cryptographic signature that you **must verify** to ensure authenticity.

#### Webhook Request Headers

Each webhook delivery includes these headers:

| Header | Description | Example |
|--------|-------------|---------|
| `X-Webhook-Signature` | HMAC-SHA256 signature | `sha256=a1b2c3d4...` |
| `X-Webhook-Event` | Event type | `business-closed` |
| `X-Webhook-Delivery-Id` | Unique delivery ID | `550e8400-e29b-41d4...` |
| `User-Agent` | Always set to this value | `DomainMonitor-Webhook/1.0` |

#### Signature Verification

To verify the webhook signature:

1. Get your webhook signing secret (from creation or regeneration)
2. Retrieve the raw request body as received (don't parse it first)
3. Compute HMAC-SHA256 hash using your secret as the key
4. Format as `sha256={hex_digest}`
5. Compare with `X-Webhook-Signature` header using timing-safe comparison

#### Verification Code Examples

**Node.js (Express):**

```javascript
const crypto = require('crypto');
const express = require('express');

const app = express();

function verifyWebhookSignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const expectedSignature = `sha256=${hmac.digest('hex')}`;

  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

app.post('/webhooks/domain-monitor', express.json(), (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  const eventType = req.headers['x-webhook-event'];
  const deliveryId = req.headers['x-webhook-delivery-id'];
  const secret = process.env.WEBHOOK_SECRET;

  // Verify signature
  if (!verifyWebhookSignature(req.body, signature, secret)) {
    console.error('Invalid webhook signature');
    return res.status(401).send('Invalid signature');
  }

  // Process webhook event
  console.log(`Received event: ${eventType}`);
  console.log(`Delivery ID: ${deliveryId}`);
  console.log('Payload:', req.body);

  // Handle specific events
  switch (eventType) {
    case 'business-closed':
      handleBusinessClosed(req.body);
      break;
    case 'sentiment':
      handleNegativeSentiment(req.body);
      break;
    case 'website':
      handleWebsiteCheck(req.body);
      break;
    default:
      console.log(`Unhandled event type: ${eventType}`);
  }

  // Return 200 to acknowledge receipt
  res.status(200).send('OK');
});

function handleBusinessClosed(data) {
  console.log(`Business closed: ${data.data.domain}`);
  console.log(`Recommendation: ${data.data.recommendation}`);
  // Your business logic here
}

function handleNegativeSentiment(data) {
  console.log(`Negative sentiment for: ${data.data.domain}`);
  // Your business logic here
}

function handleWebsiteCheck(data) {
  console.log(`Website check complete: ${data.data.domain}`);
  // Your business logic here
}

app.listen(3000);
```

**Python (Flask):**

```python
import hmac
import hashlib
import json
import os
from flask import Flask, request

app = Flask(__name__)

def verify_webhook_signature(payload, signature, secret):
    expected_signature = 'sha256=' + hmac.new(
        secret.encode('utf-8'),
        json.dumps(payload, separators=(',', ':')).encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    # Use timing-safe comparison
    return hmac.compare_digest(signature, expected_signature)

@app.route('/webhooks/domain-monitor', methods=['POST'])
def handle_webhook():
    signature = request.headers.get('X-Webhook-Signature')
    event_type = request.headers.get('X-Webhook-Event')
    delivery_id = request.headers.get('X-Webhook-Delivery-Id')
    secret = os.environ.get('WEBHOOK_SECRET')

    # Verify signature
    if not verify_webhook_signature(request.json, signature, secret):
        print('Invalid webhook signature')
        return 'Invalid signature', 401

    # Process webhook event
    print(f'Received event: {event_type}')
    print(f'Delivery ID: {delivery_id}')
    print(f'Payload: {request.json}')

    # Handle specific events
    if event_type == 'business-closed':
        handle_business_closed(request.json)
    elif event_type == 'sentiment':
        handle_negative_sentiment(request.json)
    elif event_type == 'website':
        handle_website_check(request.json)
    else:
        print(f'Unhandled event type: {event_type}')

    # Return 200 to acknowledge receipt
    return 'OK', 200

def handle_business_closed(payload):
    domain = payload['data']['domain']
    recommendation = payload['data']['recommendation']
    print(f'Business closed: {domain}')
    print(f'Recommendation: {recommendation}')
    # Your business logic here

def handle_negative_sentiment(payload):
    domain = payload['data']['domain']
    print(f'Negative sentiment for: {domain}')
    # Your business logic here

def handle_website_check(payload):
    domain = payload['data']['domain']
    print(f'Website check complete: {domain}')
    # Your business logic here

if __name__ == '__main__':
    app.run(port=3000)
```

**PHP:**

```php
<?php

function verifyWebhookSignature($payload, $signature, $secret) {
    $expectedSignature = 'sha256=' . hash_hmac(
        'sha256',
        json_encode($payload),
        $secret
    );

    // Use timing-safe comparison
    return hash_equals($signature, $expectedSignature);
}

// Get webhook data
$payload = json_decode(file_get_contents('php://input'), true);
$signature = $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'];
$eventType = $_SERVER['HTTP_X_WEBHOOK_EVENT'];
$deliveryId = $_SERVER['HTTP_X_WEBHOOK_DELIVERY_ID'];
$secret = getenv('WEBHOOK_SECRET');

// Verify signature
if (!verifyWebhookSignature($payload, $signature, $secret)) {
    error_log('Invalid webhook signature');
    http_response_code(401);
    exit('Invalid signature');
}

// Process webhook event
error_log("Received event: $eventType");
error_log("Delivery ID: $deliveryId");

// Handle specific events
switch ($eventType) {
    case 'business-closed':
        handleBusinessClosed($payload);
        break;
    case 'sentiment':
        handleNegativeSentiment($payload);
        break;
    case 'website':
        handleWebsiteCheck($payload);
        break;
    default:
        error_log("Unhandled event type: $eventType");
}

// Return 200 to acknowledge receipt
http_response_code(200);
echo 'OK';

function handleBusinessClosed($payload) {
    $domain = $payload['data']['domain'];
    $recommendation = $payload['data']['recommendation'];
    error_log("Business closed: $domain");
    error_log("Recommendation: $recommendation");
    // Your business logic here
}

function handleNegativeSentiment($payload) {
    $domain = $payload['data']['domain'];
    error_log("Negative sentiment for: $domain");
    // Your business logic here
}

function handleWebsiteCheck($payload) {
    $domain = $payload['data']['domain'];
    error_log("Website check complete: $domain");
    // Your business logic here
}
```

---

### Webhook Payload Format

All webhook events follow this structure:

```json
{
  "event": "business-closed",
  "description": "Business appears to be closed based on verification data",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "domainId": "550e8400-e29b-41d4-a716-446655440000",
    "domain": "example.com",
    "status": "active",
    "provider": "truebiz"
  }
}
```

#### Payload Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event` | string | Yes | The event type that triggered this webhook (e.g., `business-closed`, `sentiment`, `website`, `business-profile`) |
| `description` | string | No | Human-readable description of the event (may be `null`) |
| `timestamp` | string | Yes | ISO 8601 timestamp when the event occurred |
| `data` | object | Yes | Event-specific data |
| `data.domainId` | string (UUID) | Yes | UUID of the domain associated with this event |
| `data.domain` | string | Yes | The domain name |
| `data.status` | string | Yes | Current domain status (`active` or `inactive`) |
| `data.provider` | string | Yes | The provider that triggered this event (e.g., `truebiz`) |



#### Example: Test Event

When you test a webhook endpoint, you'll receive:

```json
{
  "event": "webhook.test",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "message": "This is a test webhook from Domain Monitor API"
  }
}
```

---

### Webhook Delivery Logs

Monitor webhook deliveries to debug issues and track reliability.

#### View Deliveries for Specific Endpoint

```bash
curl -X GET "https://dev-domainmonitor.ipo-servers.net/api/v1/user-webhooks/{id}/deliveries?limit=50" \
  -H "Authorization: Bearer <token>"
```

**Response:**
```json
{
  "message": "Delivery logs retrieved successfully",
  "data": [
    {
      "id": "delivery-uuid-1",
      "eventType": "business-closed",
      "domainId": "domain-uuid-1",
      "attemptNumber": 1,
      "status": "success",
      "responseStatus": 200,
      "durationMs": 245,
      "errorMessage": null,
      "sentAt": "2024-01-15T10:00:00.000Z",
      "completedAt": "2024-01-15T10:00:00.245Z",
      "createdAt": "2024-01-15T10:00:00.000Z"
    },
    {
      "id": "delivery-uuid-2",
      "eventType": "sentiment",
      "domainId": "domain-uuid-2",
      "attemptNumber": 2,
      "status": "failed",
      "responseStatus": 500,
      "durationMs": 5000,
      "errorMessage": "Connection timeout",
      "sentAt": "2024-01-15T09:50:00.000Z",
      "completedAt": "2024-01-15T09:50:05.000Z",
      "createdAt": "2024-01-15T09:50:00.000Z"
    }
  ]
}
```

#### List All Delivery Logs

View deliveries across all webhook endpoints:

```bash
curl -X GET "https://dev-domainmonitor.ipo-servers.net/api/v1/user-webhooks/deliveries?status=failed&limit=100" \
  -H "Authorization: Bearer <token>"
```

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (min: 1) |
| `limit` | integer | 100 | Items per page (min: 1, max: 1000) |
| `status` | string | - | Filter by status: `pending`, `success`, `failed`, `retrying` |
| `userId` | string (UUID) | - | Filter by user ID (superadmin/reseller only) |
| `domainId` | string (UUID) | - | Filter by domain ID |
| `dateFrom` | string (ISO 8601) | - | Filter deliveries from this date (e.g., `2025-01-01` or `2025-01-01T00:00:00Z`) |
| `dateTo` | string (ISO 8601) | - | Filter deliveries until this date (must be >= `dateFrom`) |

**Response:**
```json
{
  "message": "Delivery logs retrieved successfully",
  "data": [
    {
      "id": "delivery-uuid",
      "endpointId": "webhook-uuid",
      "endpointUrl": "https://your-app.com/webhooks",
      "eventType": "business-closed",
      "domainId": "domain-uuid",
      "attemptNumber": 1,
      "status": "success",
      "responseStatus": 200,
      "durationMs": 156,
      "sentAt": "2024-01-15T10:00:00.000Z",
      "completedAt": "2024-01-15T10:00:00.156Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 100,
    "total": 250
  }
}
```

#### Delivery Status Values

| Status | Description |
|--------|-------------|
| `pending` | Delivery queued but not yet sent |
| `success` | Delivered successfully (2xx response) |
| `failed` | All retry attempts failed |
| `retrying` | Delivery failed, will retry |

---

### Webhook Retry Policy

Failed webhook deliveries are automatically retried:

- **Retry attempts:** 3 attempts total
- **Retry schedule:**
  - 1st retry: After 1 minute
  - 2nd retry: After 5 minutes
  - 3rd retry: After 15 minutes
- **Timeout:** 10 seconds per delivery attempt
- **Success criteria:** Any 2xx HTTP response code

#### Disabling Endpoint After Failures

If an endpoint consistently fails, it may be automatically disabled:
- After 10 consecutive failed deliveries
- You'll receive an email notification
- Re-enable via PATCH `/api/v1/user-webhooks/{id}` with `"enabled": true`

---

### Webhook Best Practices

#### 1. Security

- **Always verify signatures** - Never process webhooks without verification
- **Use timing-safe comparison** - Prevents timing attacks
- **Store secrets securely** - Use environment variables or secrets manager
- **Rotate secrets regularly** - Regenerate if compromised
- **Use HTTPS only** - HTTP endpoints are rejected

#### 2. Response Requirements

- **Respond quickly** - Return 2xx within 10 seconds
- **Process asynchronously** - Queue webhook for background processing
- **Return before processing** - Don't wait for business logic to complete

```javascript
// Good: Queue and respond immediately
app.post('/webhooks', express.json(), async (req, res) => {
  if (!verifySignature(req.body, req.headers['x-webhook-signature'])) {
    return res.status(401).send('Invalid signature');
  }

  // Queue for background processing
  await queue.add('webhook', req.body);

  // Respond immediately
  res.status(200).send('OK');
});
```

#### 3. Idempotency

- **Handle duplicate deliveries** - Use `X-Webhook-Delivery-Id` to deduplicate
- **Store delivery IDs** - Track processed webhooks
- **Make handlers idempotent** - Safe to process same event multiple times

```javascript
const processedDeliveries = new Set();

app.post('/webhooks', express.json(), (req, res) => {
  const deliveryId = req.headers['x-webhook-delivery-id'];

  // Check if already processed
  if (processedDeliveries.has(deliveryId)) {
    return res.status(200).send('Already processed');
  }

  // Process webhook...
  processedDeliveries.add(deliveryId);
  res.status(200).send('OK');
});
```

#### 4. Error Handling

- **Return appropriate status codes**
  - `200-299`: Success (delivery marked successful)
  - `4xx`: Client error (no retry)
  - `5xx`: Server error (will retry)
- **Log all webhook activity** - For debugging and audit
- **Monitor delivery success rates** - Set up alerts for failures

#### 5. Testing

- **Use test endpoint** - Verify your webhook handler works
- **Test signature verification** - Ensure security is working
- **Simulate failures** - Test retry behavior
- **Monitor delivery logs** - Check for issues

---

### Webhook vs Polling

| Aspect | Webhooks | Polling |
|--------|----------|---------|
| Latency | Real-time | Delayed by poll interval |
| API Calls | Minimal | Frequent |
| Efficiency | High | Low |
| Implementation | More complex | Simple |
| Reliability | Retries on failure | Consistent |
| Best For | Real-time needs | Simple integrations |

**Recommendation:** Use webhooks for production systems monitoring many domains. Use polling for simple integrations or during initial development.

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
    "userId": "merchant-user-uuid"
  }'
```

The `userId` field is only available to superadmin and reseller roles.

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
