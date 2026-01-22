# Webhook Setup Guide

## Overview

The Domain Monitor API can receive webhooks from monitoring providers (TrueBiz) to get real-time alerts about domain changes. This eliminates the need for polling and provides instant notifications.

---

## Architecture

```
┌─────────────┐         ┌──────────────────────┐         ┌───────────────┐
│   TrueBiz   │         │  Webhook Controller  │         │   Provider    │
│  Monitoring │         │  /webhooks/:provider │         │    Service    │
└──────┬──────┘         └──────────┬───────────┘         └───────┬───────┘
       │                           │                             │
       │  1. POST /webhooks/       │                             │
       │     truebiz               │                             │
       │  { type, alert_id, ... }  │                             │
       │──────────────────────────>│                             │
       │                           │                             │
       │                           │  2. Verify signature        │
       │                           │     (Svix)                  │
       │                           │                             │
       │                           │  3. Store event             │
       │                           │     in webhook_events       │
       │                           │                             │
       │                           │  4. Route to provider       │
       │                           │────────────────────────────>│
       │                           │                             │
       │                           │  5. Fetch alert details     │
       │                           │<────────────────────────────│
       │  GET /monitoring/alerts/  │                             │
       │      {alert_id}           │                             │
       │<──────────────────────────│                             │
       │                           │                             │
       │  Alert details            │                             │
       │──────────────────────────>│                             │
       │                           │                             │
       │                           │  6. Match & update domain   │
       │                           │────────────────────────────>│
       │                           │                             │
       │  200 OK                   │                             │
       │<──────────────────────────│                             │
```

---

## Setup Instructions

### 1. Run Database Migration

The webhook system requires two migrations:
- `005_add_webhook_events.sql` - Creates the webhook_events table
- `006_add_webhook_secret_to_providers.sql` - Adds webhook_secret_encrypted field to providers table

```bash
node migrations/migrate.js
```

### 2. Configure Webhook Secret in Database

The webhook secret is stored encrypted in the providers table. You can set it via the provider management API:

```bash
# Get the provider ID first
curl -X GET https://dev-domainmonitor.ipo-servers.net/api/v1/admin/providers \
  -H "Authorization: Bearer <superadmin_token>"

# Update the webhook secret (it will be automatically encrypted)
curl -X PATCH https://dev-domainmonitor.ipo-servers.net/api/v1/admin/providers/{provider_id} \
  -H "Authorization: Bearer <superadmin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "webhookSecret": "whsec_xxxxxxxxxxxxxxxxxxxxx"
  }'

# You can also update other provider fields at the same time
curl -X PATCH https://dev-domainmonitor.ipo-servers.net/api/v1/admin/providers/{provider_id} \
  -H "Authorization: Bearer <superadmin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "apiKey": "sk_live_xxxxxxxxxx",
    "webhookSecret": "whsec_xxxxxxxxxxxxxxxxxxxxx",
    "enabled": true
  }'
```

The webhook secret is provided by TrueBiz when you register your webhook endpoint with them.

### 3. Configure Webhook in TrueBiz

You need to register your webhook endpoint with TrueBiz. This is typically done via their API or dashboard.

**Webhook URL:**
```
https://dev-domainmonitor.ipo-servers.net/api/v1/webhooks/truebiz
```

**For production:**
```
https://domainmonitor.ipo-servers.net/api/v1/webhooks/truebiz
```

#### Using TrueBiz API to Configure Webhook

```bash
curl -X POST https://ae.truebiz.io/api/v1/webhooks \
  -H "X-API-KEY: your_truebiz_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://dev-domainmonitor.ipo-servers.net/api/v1/webhooks/truebiz",
    "events": ["io.truebiz.monitoring.alert"]
  }'
```

TrueBiz uses Svix for webhook delivery, so they'll provide you with a webhook secret (`whsec_...`).

---

## Webhook Endpoints

### Receive Webhook (Public)

```
POST /api/v1/webhooks/:provider
```

**Parameters:**
- `:provider` - Provider name (e.g., `truebiz`)

**Headers:**
- `svix-signature` - Webhook signature for verification

**Example Request:**

```bash
curl -X POST https://dev-domainmonitor.ipo-servers.net/api/v1/webhooks/truebiz \
  -H "Content-Type: application/json" \
  -H "svix-signature: v1,xxxxx..." \
  -d '{
    "type": "io.truebiz.monitoring.alert",
    "created_at": "2025-01-12T08:15:42.555073+00:00",
    "alert_detail_link": {
      "href": "https://ae.truebiz.io/api/v1/monitoring/alerts/94347f66-0601-4b94-adca-adea9d4daa82/"
    },
    "ui_portal_link": {
      "href": "https://app.truebiz.io/monitoring/alerts/94347f66-0601-4b94-adca-adea9d4daa82/"
    }
  }'
```

**Response:**

```json
{
  "success": true,
  "message": "Webhook received and processed",
  "webhookEventId": "uuid-of-webhook-event",
  "processed": true
}
```

### List Webhook Events (Superadmin Only)

```
GET /api/v1/webhooks/:provider/events
```

**Query Parameters:**
- `limit` - Number of events to return (default: 100)
- `offset` - Offset for pagination (default: 0)
- `processed` - Filter by processed status (`true`/`false`)

**Example:**

```bash
curl -X GET "https://dev-domainmonitor.ipo-servers.net/api/v1/webhooks/truebiz/events?limit=10&processed=false" \
  -H "Authorization: Bearer <superadmin_token>"
```

### Retry Failed Webhook (Superadmin Only)

```
POST /api/v1/webhooks/events/:id/retry
```

Retry processing a failed webhook event.

**Example:**

```bash
curl -X POST https://dev-domainmonitor.ipo-servers.net/api/v1/webhooks/events/uuid-123/retry \
  -H "Authorization: Bearer <superadmin_token>"
```

---

## TrueBiz Webhook Flow

### Step 1: TrueBiz Sends Webhook

When a monitoring alert is detected, TrueBiz sends a webhook:

```json
{
  "type": "io.truebiz.monitoring.alert",
  "created_at": "2025-01-12T08:15:42.555073+00:00",
  "alert_detail_link": {
    "href": "https://ae.truebiz.io/api/v1/monitoring/alerts/94347f66-xxxx/"
  },
  "ui_portal_link": {
    "href": "https://app.truebiz.io/monitoring/alerts/94347f66-xxxx/"
  }
}
```

### Step 2: Signature Verification

The webhook controller verifies the Svix signature to ensure authenticity:

```javascript
const { Webhook } = require('svix');
const wh = new Webhook(process.env.TRUEBIZ_WEBHOOK_SECRET);
wh.verify(JSON.stringify(payload), req.headers);
```

### Step 3: Fetch Alert Details

The TrueBizProvider fetches full alert details from the API:

```bash
GET https://ae.truebiz.io/api/v1/monitoring/alerts/94347f66-xxxx/
```

**Alert Response:**

```json
{
  "id": "94347f66-0601-4b94-adca-adea9d4daa82",
  "domain": "example.com",
  "external_ref_id": "your-tracking-id-123",
  "flagged_categories": ["suspicious_activity", "content_change"],
  "created_at": "2025-01-12T08:15:42.555073+00:00",
  "severity": "high"
}
```

### Step 4: Match Domain

The system matches the domain in the alert with your database using:
1. **Primary method:** `external_ref_id` (matches your domain ID directly)
2. **Fallback:** Domain name (if external_ref_id not found)

### Step 5: Update Domain

Creates a check history entry with the alert information:

```javascript
await domainRepository.createCheckHistory({
  domainId: domain.id,
  recommendation: 'review',
  provider: 'truebiz',
  rawData: alertData
});
```

---

## Domain Matching

The system automatically uses your internal domain ID as the `external_ref_id` when starting monitoring with TrueBiz. This ensures reliable webhook matching:

**How it works:**

1. When you create a domain and start monitoring, the system automatically sends your domain ID as `external_ref_id` to TrueBiz
2. TrueBiz includes this `external_ref_id` in their webhook alerts
3. When a webhook arrives, the system matches it directly to your domain using the ID

**Example domain creation:**

```bash
curl -X POST https://dev-domainmonitor.ipo-servers.net/api/v1/domains \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "example.com",
    "checkFrequency": "daily"
  }'
```

**No additional configuration needed** - the domain ID is automatically used for webhook matching.

---

## Database Schema

### webhook_events Table

```sql
CREATE TABLE webhook_events (
  id CHAR(36) PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  domain_id CHAR(36),
  payload JSON NOT NULL,
  signature VARCHAR(500),
  verified BOOLEAN DEFAULT FALSE,
  processed BOOLEAN DEFAULT FALSE,
  processed_at DATETIME,
  error_message TEXT,
  received_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_provider (provider),
  INDEX idx_domain_id (domain_id),
  INDEX idx_processed (processed),

  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE SET NULL
);
```

---

## Adding New Providers

To add webhook support for a new provider:

### 1. Implement `handleWebhook()` in Provider Class

```javascript
class NewProvider extends BaseProvider {
  async handleWebhook(webhookPayload, findDomainByExternalRef) {
    // 1. Extract relevant data from webhook
    // 2. Fetch additional details if needed
    // 3. Find matching domain
    // 4. Update domain/create check history
    // 5. Return result

    return {
      processed: true,
      domainId: domain.id,
      domain: domain.domain,
      action: 'check_history_created'
    };
  }
}
```

### 2. Add Webhook Secret to Environment

```bash
NEWPROVIDER_WEBHOOK_SECRET=your_secret_here
```

### 3. Configure Webhook URL

Register your endpoint with the provider:

```
https://your-domain.com/api/v1/webhooks/newprovider
```

---

## Security

### Signature Verification

Always verify webhook signatures to prevent spoofing:

1. **Svix (TrueBiz):** Uses `svix-signature` header
2. **Custom:** Implement HMAC verification using provider secret

### Error Handling

Failed webhooks are:
1. Stored in the database with error message
2. Can be retried via admin endpoint
3. Don't block the webhook response (always return 200 OK)

### Rate Limiting

Consider implementing rate limiting for webhook endpoints to prevent abuse:

```javascript
// In app.js
const rateLimit = require('express-rate-limit');

const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100 // limit each provider to 100 requests per minute
});

app.use('/api/v1/webhooks', webhookLimiter);
```

---

## Testing

### Test Webhook Locally

Use a tool like ngrok to expose your local server:

```bash
ngrok http 3000
```

Then configure TrueBiz to send webhooks to:
```
https://your-ngrok-url.ngrok.io/api/v1/webhooks/truebiz
```

### Manual Webhook Testing

Send a test webhook:

```bash
curl -X POST http://localhost:3000/api/v1/webhooks/truebiz \
  -H "Content-Type: application/json" \
  -d '{
    "type": "io.truebiz.monitoring.alert",
    "created_at": "2025-01-22T10:00:00Z",
    "alert_detail_link": {
      "href": "https://ae.truebiz.io/api/v1/monitoring/alerts/test-alert-id/"
    }
  }'
```

---

## Monitoring

### Check Webhook Processing

Query unprocessed webhooks:

```sql
SELECT * FROM webhook_events
WHERE processed = FALSE
ORDER BY received_at DESC;
```

### View Webhook Logs

```javascript
// In your logger
logger.info({ provider: 'truebiz', webhookEventId }, 'Webhook received');
```

---

## Troubleshooting

### Webhook Not Received

1. Check firewall rules allow HTTPS POST to your server
2. Verify webhook URL is correct in TrueBiz dashboard
3. Check server logs for connection attempts
4. Ensure SSL certificate is valid

### Signature Verification Failed

1. Verify `TRUEBIZ_WEBHOOK_SECRET` is correct
2. Check webhook secret hasn't been rotated
3. Ensure you're using the raw request body for verification

### Domain Not Found

1. Verify `externalTrackingRef` was set when creating domain
2. Check domain name in alert matches database
3. Review webhook event payload in database

### Webhook Processed but No Update

1. Check `domain_check_history` table for new entries
2. Verify provider's `handleWebhook` method logic
3. Review error_message in webhook_events table

---

## References

- [TrueBiz Monitoring API Documentation](https://ae.truebiz.io/api/v1/docs)
- [Svix Webhook Documentation](https://docs.svix.com)
- [Domain Monitor API Integration Guide](./API-INTEGRATION-GUIDE.md)
