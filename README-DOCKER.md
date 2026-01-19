# Docker Development Setup

## Overview
This setup enables live code synchronization between your host machine and Docker container using volume mounts. Changes to your code will automatically trigger nodemon to restart the server.

## Quick Start

### Initial Build
```bash
# Build the Docker image
docker build -t domain-monitor:latest .
```

### Development Mode (Live Sync)
```bash
# Linux/Mac/AWS
chmod +x docker-run-dev.sh
./docker-run-dev.sh

# Windows
docker-run-dev.bat
```

### What Gets Synced
The following directories/files are mounted as volumes:
- `src/` - All application code
- `migrations/` - Database migration files
- `package.json` - Dependencies (restart container if changed)
- `.env.local` - Environment variables

### File Changes Workflow

1. **Edit files locally** via SFTP or on server
2. **Nodemon detects changes** automatically
3. **Server restarts** in container
4. **Test immediately** - no rebuild needed

## Commands

### View Logs
```bash
docker logs -f domain-monitor
```

### Restart Container
```bash
docker restart domain-monitor
```

### Stop Container
```bash
docker stop domain-monitor
```

### Rebuild (if package.json changes)
```bash
docker stop domain-monitor
docker rm domain-monitor
docker build -t domain-monitor:latest .
./docker-run-dev.sh
```

### Run Migrations
```bash
docker exec domain-monitor npm run migrate
```

### Access Container Shell
```bash
docker exec -it domain-monitor sh
```

## Traditional Run (No Live Sync)

If you want to copy files into the image instead of mounting:

```bash
docker build -t domain-monitor:latest .
docker run -d \
  --name domain-monitor \
  -p 3000:3000 \
  --env-file {.env.local} \
  --restart unless-stopped \
  domain-monitor:latest
```

This requires rebuilding the image every time you make code changes.

## Comparison

| Feature | Live Sync (Volumes) | Traditional (Copy) |
|---------|---------------------|-------------------|
| Code changes | Instant | Requires rebuild |
| Performance | Slightly slower I/O | Faster I/O |
| Dev experience | Excellent | Poor |
| Production | Not recommended | Recommended |
| Use case | Development | UAT/Production |

## Database Migrations

Migrations are run separately from container startup to give you control over when schema changes happen.

### Running Migrations

After deploying new code or starting the container:

```bash
# Run all pending migrations
docker exec domain-monitor npm run migrate
```

This will:
- Check which migrations have already been executed
- Run only new/pending migrations
- Track executed migrations in `migrations_log` table

### Migration Best Practices

**✅ DO:**
- Run migrations after deploying new code
- Test migrations on dev/UAT before production
- Keep migrations in sequential order (001, 002, 003...)
- Create new migration files for schema changes

**❌ DON'T:**
- Modify already-executed migration files
- Run migrations during Docker build
- Auto-run migrations on container start
- Delete old migration files

### Deployment Workflow

```bash
# 1. Build and deploy new container
docker stop domain-monitor
docker rm domain-monitor
docker build -t domain-monitor:latest .
./docker-run-dev.sh

# 2. Run migrations (separate step)
docker exec domain-monitor npm run migrate

# 3. Verify
curl https://dev-domainmonitor.ipo-servers.net/health
```

### Available Migrations

| File | Description |
|------|-------------|
| `001_initial_schema.sql` | Core tables: users, domains, providers, webhooks, etc. |
| `002_update_user_roles.sql` | Updates user roles from [user, admin] to [superadmin, reseller, merchant] |
| `003_add_reseller_relationships.sql` | Creates reseller_merchant_relationships table for RBAC |
| `004_add_provider_api_logs.sql` | Creates provider_api_logs table for API audit trail |

### Creating New Migrations

Create a new SQL file in `migrations/` directory:

```bash
# Example: migrations/005_add_new_feature.sql
-- Add your SQL statements here
CREATE TABLE ...
ALTER TABLE ...
```

The migration runner will automatically pick it up on next run.

### Checking Migration Status

```bash
# View executed migrations
docker exec domain-monitor sh -c 'mysql -h $DB_HOST -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "SELECT * FROM migrations_log ORDER BY executed_at DESC"'
```

## Production Deployment

For UAT/Production, use the traditional approach without volumes:

```bash
# Build production image
docker build -t domain-monitor:production .

# Run without volume mounts
docker run -d \
  --name domain-monitor \
  -p 3000:3000 \
  --env-file .env \
  --restart unless-stopped \
  domain-monitor:production

# Run migrations after deployment
docker exec domain-monitor npm run migrate
```

## Troubleshooting

### Changes not reflecting?
- Check if nodemon is running: `docker logs domain-monitor`
- Verify volume mounts: `docker inspect domain-monitor`
- Restart container: `docker restart domain-monitor`

### Permission issues?
```bash
# On Linux/Mac server
sudo chown -R $(whoami):$(whoami) /var/www/domain-monitor
```

### Port already in use?
```bash
# Stop existing container
docker stop domain-monitor

# Or use different port
docker run -p 3001:3000 ...
```
