# Provider Setup Guide

## Overview
Provider credentials (API keys) are stored encrypted in the database, not in environment variables. This provides better security and allows dynamic provider management.

## Prerequisites

1. **Generate Encryption Key**
   ```bash
   openssl rand -base64 32
   ```

2. **Add to .env**
   ```bash
   ENCRYPTION_KEY=<your_generated_key>
   ```

## Adding a Provider

### Method 1: Using the Script (Recommended)

```bash
# On your server
cd /var/www/domain-monitor
node scripts/add-provider.js
```

Follow the prompts:
```
Provider name (e.g., truebiz): truebiz
Display name (e.g., TrueBiz Web Presence): TrueBiz Web Presence
API Base URL (e.g., https://ae.truebiz.io/api/v1): https://ae.truebiz.io/api/v1
API Key: <paste_your_truebiz_api_key>
Priority (lower = higher priority, default 100): 10
Rate limit (requests/minute, default 60): 60
Timeout (ms, default 10000): 10000
Enabled? (y/n, default y): y
```

### Method 2: Direct Database Insert

```sql
-- Encrypt your API key first using the encryption utility
-- Then insert into database

INSERT INTO providers (
  id,
  name,
  display_name,
  enabled,
  priority,
  api_base_url,
  api_key_encrypted,
  rate_limit,
  timeout,
  config
) VALUES (
  UUID(),
  'truebiz',
  'TrueBiz Web Presence',
  TRUE,
  10,
  'https://ae.truebiz.io/api/v1',
  '<encrypted_api_key>',
  60,
  10000,
  '{}'
);
```

### Method 3: Via API (Future)

An admin API endpoint will be added for provider management:
```bash
POST /api/v1/admin/providers
Authorization: Bearer <admin_token>

{
  "name": "truebiz",
  "displayName": "TrueBiz Web Presence",
  "apiBaseUrl": "https://ae.truebiz.io/api/v1",
  "apiKey": "your_api_key",
  "priority": 10,
  "rateLimit": 60,
  "timeout": 10000
}
```

## Provider Priority

The system supports multiple providers with fallback:
- **Priority 10** - Primary provider (checked first)
- **Priority 20** - Secondary provider (fallback)
- **Priority 30+** - Additional fallbacks

Lower priority number = higher preference.

## Restart Required

After adding or updating a provider, restart your application:

```bash
# Docker
docker restart domain-monitor

# Or rebuild
./docker-run-dev.sh
```

## Verifying Provider Setup

Check the logs on startup:
```bash
docker logs domain-monitor | grep -i provider
```

You should see:
```
{"level":"info","provider":"truebiz","msg":"Provider registered"}
{"level":"info","provider":"truebiz","msg":"Primary provider set"}
{"level":"info","count":1,"msg":"Provider service initialized"}
```

## Managing Providers

### Disable a Provider
```sql
UPDATE providers SET enabled = FALSE WHERE name = 'truebiz';
```

### Update Priority
```sql
UPDATE providers SET priority = 20 WHERE name = 'truebiz';
```

### Update API Key
```javascript
// Encrypt new key first
const { encrypt } = require('./src/utils/encryption');
const newEncrypted = encrypt('new_api_key');

// Then update
UPDATE providers SET api_key_encrypted = '<new_encrypted>' WHERE name = 'truebiz';
```

## Security Notes

1. **Never commit** unencrypted API keys
2. **ENCRYPTION_KEY** must be in .env (or AWS Secrets Manager for prod)
3. **Rotate keys** periodically
4. **Different encryption keys** for dev/uat/prod environments
5. **Backup** encryption key securely - lost key = lost data

## Troubleshooting

### "No providers configured"
- Check database: `SELECT * FROM providers WHERE enabled = TRUE;`
- Verify ENCRYPTION_KEY is set
- Check logs for initialization errors

### "Failed to decrypt API key"
- ENCRYPTION_KEY mismatch
- API key was encrypted with different key
- Re-encrypt and update provider

### Provider not loading
- Check `enabled = TRUE`
- Verify provider name matches switch case in `providerService.js`
- Check error logs during initialization
