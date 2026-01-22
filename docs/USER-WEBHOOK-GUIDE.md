# User Webhook Guide

## Overview

The Domain Monitor API allows you to register webhook endpoints to receive real-time notifications about domain events. When a domain event occurs (verification, failure, updates), the system will automatically send an HTTP POST request to your registered endpoints.

## Features

- **Real-time notifications**: Receive events as they happen
- **Automatic retries**: Failed deliveries are automatically retried (up to 3 attempts)
- **Signature verification**: All webhooks are signed for security
- **Delivery logs**: Track all webhook deliveries and their status
- **Event filtering**: Subscribe only to specific event types
- **Test functionality**: Test your endpoints before going live

---

## Quick Start

### 1. Register a Webhook Endpoint

**Subscribe to specific events:**
```bash
curl -X POST https://your-domain.com/api/v1/user-webhooks \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhooks/domain-monitor",
    "events": ["domain.verified", "domain.failed"],
    "description": "Production webhook endpoint"
  }'
```

**Subscribe to ALL events** (omit `events` field or set to `null`):
```bash
curl -X POST https://your-domain.com/api/v1/user-webhooks \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.com/webhooks/domain-monitor",
    "description": "Catch-all webhook endpoint"
  }'
```

**Response:**
```json
{
  "message": "Webhook endpoint created successfully",
  "warning": "Store the secret securely. It will not be shown again.",
  "data": {
    "id": "webhook-uuid",
    "url": "https://your-app.com/webhooks/domain-monitor",
    "events": ["domain.verified", "domain.failed"],
    "secret": "abc123...",
    "enabled": true,
    "createdAt": "2026-01-22T10:30:00.000Z"
  }
}
```

**IMPORTANT**: Save the `secret` immediately - it's only shown once!

### 2. Implement Webhook Handler

```javascript
const express = require('express');
const crypto = require('crypto');

const app = express();

// Raw body needed for signature verification
app.post('/webhooks/domain-monitor',
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    }
  }),
  (req, res) => {
    const signature = req.headers['x-webhook-signature'];
    const secret = process.env.WEBHOOK_SECRET;

    // Verify signature
    const expectedSignature = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(req.rawBody)
      .digest('hex')}`;

    if (signature !== expectedSignature) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Process the webhook
    const { event, timestamp, data } = req.body;

    console.log(`Received ${event} for domain ${data.domain}`);

    switch (event) {
      case 'domain.verified':
        // Handle domain verification
        break;
      case 'domain.failed':
        // Handle domain failure
        break;
      // Handle other events...
    }

    // Return 200 to acknowledge receipt
    res.status(200).json({ received: true });
  }
);
```

### 3. Test Your Endpoint

```bash
curl -X POST https://your-domain.com/api/v1/user-webhooks/{id}/test \
  -H "Authorization: Bearer <your_token>"
```

This sends a test webhook to verify your endpoint is working correctly.

---

## Event Types

Subscribe to one or more of these events, or omit the `events` field entirely to receive **all** events:

| Event | Description | Triggered When |
|-------|-------------|----------------|
| `domain.created` | Domain registered | User adds a new domain |
| `domain.updated` | Domain modified | User updates domain settings |
| `domain.deleted` | Domain removed | User deletes a domain |
| `domain.verified` | Domain verification successful | Provider confirms domain ownership |
| `domain.failed` | Domain verification failed | Provider cannot verify domain |
| `domain.check.completed` | Periodic check completed | Scheduled domain check finishes |

---

## Webhook Payload Format

All webhooks follow this structure:

```json
{
  "event": "domain.verified",
  "timestamp": "2026-01-22T10:30:00.000Z",
  "data": {
    "domainId": "domain-uuid",
    "domain": "example.com",
    "status": "active",
    "provider": "truebiz",
    "providerEvent": "domain.verified",
    "providerData": {
      // Provider-specific data
    }
  }
}
```

### Headers

Every webhook request includes these headers:

| Header | Description | Example |
|--------|-------------|---------|
| `Content-Type` | Always `application/json` | `application/json` |
| `X-Webhook-Signature` | HMAC-SHA256 signature | `sha256=abc123...` |
| `X-Webhook-Event` | Event type | `domain.verified` |
| `X-Webhook-Delivery-Id` | Unique delivery ID (for deduplication) | `uuid` |
| `User-Agent` | Identifies the webhook sender | `DomainMonitor-Webhook/1.0` |

---

## Security

### Verify Webhook Signatures

**Always verify webhook signatures** to ensure requests are from Domain Monitor:

```javascript
function verifyWebhookSignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const expectedSignature = `sha256=${hmac.digest('hex')}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### Best Practices

1. **Use HTTPS**: Webhook URLs must use HTTPS (not HTTP)
2. **Verify signatures**: Always validate `X-Webhook-Signature`
3. **Return quickly**: Respond with 200 within 10 seconds
4. **Process async**: Handle heavy processing in background jobs
5. **Idempotency**: Use `X-Webhook-Delivery-Id` to prevent duplicate processing
6. **Store secrets securely**: Never commit webhook secrets to version control

---

## Retry Logic

Failed webhook deliveries are automatically retried:

| Attempt | Retry After | Total Time |
|---------|-------------|------------|
| 1 (initial) | Immediate | 0s |
| 2 | 1 minute | 1m |
| 3 | 5 minutes | 6m |
| 4 (final) | 15 minutes | 21m |

**Auto-disable**: After 10 consecutive failures, the endpoint is automatically disabled.

### Return Codes

| Status Code | Behavior |
|-------------|----------|
| 200-299 | Success - no retry |
| 400-499 | Client error - no retry (except 408, 429) |
| 500-599 | Server error - will retry |
| Timeout (10s) | Network error - will retry |

---

## Managing Webhook Endpoints

### List Your Endpoints

```bash
curl -X GET https://your-domain.com/api/v1/user-webhooks \
  -H "Authorization: Bearer <your_token>"
```

### Update an Endpoint

```bash
curl -X PATCH https://your-domain.com/api/v1/user-webhooks/{id} \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "events": ["domain.verified", "domain.failed", "domain.check.completed"],
    "enabled": true
  }'
```

### Regenerate Secret

If your secret is compromised:

```bash
curl -X POST https://your-domain.com/api/v1/user-webhooks/{id}/regenerate-secret \
  -H "Authorization: Bearer <your_token>"
```

### Delete an Endpoint

```bash
curl -X DELETE https://your-domain.com/api/v1/user-webhooks/{id} \
  -H "Authorization: Bearer <your_token>"
```

---

## Monitoring Deliveries

### View Delivery Logs

```bash
curl -X GET https://your-domain.com/api/v1/user-webhooks/{id}/deliveries?limit=50 \
  -H "Authorization: Bearer <your_token>"
```

**Response:**
```json
{
  "message": "Delivery logs retrieved successfully",
  "data": [
    {
      "id": "log-uuid",
      "eventType": "domain.verified",
      "domainId": "domain-uuid",
      "attemptNumber": 1,
      "status": "success",
      "responseStatus": 200,
      "durationMs": 245,
      "sentAt": "2026-01-22T10:30:00.000Z",
      "completedAt": "2026-01-22T10:30:00.245Z",
      "createdAt": "2026-01-22T10:30:00.000Z"
    }
  ]
}
```

---

## Example Implementations

### Node.js/Express

```javascript
const express = require('express');
const crypto = require('crypto');

const app = express();
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

app.post('/webhooks/domain-monitor',
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    }
  }),
  async (req, res) => {
    // Verify signature
    const signature = req.headers['x-webhook-signature'];
    const expected = `sha256=${crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(req.rawBody)
      .digest('hex')}`;

    if (signature !== expected) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Acknowledge immediately
    res.status(200).json({ received: true });

    // Process asynchronously
    processWebhook(req.body).catch(console.error);
  }
);

async function processWebhook(payload) {
  const { event, data } = payload;

  switch (event) {
    case 'domain.verified':
      await notifyUserDomainVerified(data);
      break;
    case 'domain.failed':
      await alertUserDomainFailed(data);
      break;
  }
}
```

### Python/Flask

```python
import hmac
import hashlib
from flask import Flask, request, jsonify

app = Flask(__name__)
WEBHOOK_SECRET = os.environ['WEBHOOK_SECRET']

@app.route('/webhooks/domain-monitor', methods=['POST'])
def handle_webhook():
    # Get signature
    signature = request.headers.get('X-Webhook-Signature', '')

    # Verify signature
    expected = 'sha256=' + hmac.new(
        WEBHOOK_SECRET.encode(),
        request.data,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(signature, expected):
        return jsonify({'error': 'Invalid signature'}), 401

    # Parse payload
    payload = request.json
    event = payload['event']
    data = payload['data']

    # Process webhook (async recommended)
    if event == 'domain.verified':
        notify_user_domain_verified(data)
    elif event == 'domain.failed':
        alert_user_domain_failed(data)

    return jsonify({'received': True})
```

---

## Troubleshooting

### Webhook Not Received

1. **Check endpoint is enabled**: `GET /api/v1/user-webhooks/{id}`
2. **Check event subscription**: Ensure you're subscribed to the event
3. **View delivery logs**: Check for errors in `/deliveries`
4. **Test endpoint**: Use `/test` to verify connectivity

### Signature Verification Fails

1. **Use raw body**: Don't parse JSON before verifying
2. **Check secret**: Ensure you're using the correct secret
3. **Case sensitive**: Signature must match exactly
4. **Format**: Signature includes `sha256=` prefix

### Endpoint Auto-disabled

After 10 consecutive failures, endpoints are auto-disabled. To re-enable:

```bash
curl -X PATCH https://your-domain.com/api/v1/user-webhooks/{id} \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'
```

Fix the issue causing failures before re-enabling!

---

## Rate Limits

- **Maximum endpoints per user**: 10
- **Maximum retries**: 3 attempts per delivery
- **Timeout**: 10 seconds per request
- **Delivery rate**: No rate limit (best effort)

---

## API Reference

For complete API documentation, see:
- [Swagger Documentation](./swagger.yaml)
- [Main Documentation](../README.md)

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/user-webhooks` | Create webhook endpoint |
| GET | `/api/v1/user-webhooks` | List your endpoints |
| GET | `/api/v1/user-webhooks/{id}` | Get endpoint details |
| PATCH | `/api/v1/user-webhooks/{id}` | Update endpoint |
| DELETE | `/api/v1/user-webhooks/{id}` | Delete endpoint |
| POST | `/api/v1/user-webhooks/{id}/test` | Test endpoint |
| POST | `/api/v1/user-webhooks/{id}/regenerate-secret` | Regenerate secret |
| GET | `/api/v1/user-webhooks/{id}/deliveries` | View delivery logs |

---

## Support

For issues or questions:
- Check delivery logs for error messages
- Review the troubleshooting section
- Contact support with delivery log IDs
