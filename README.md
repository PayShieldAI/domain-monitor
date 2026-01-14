# Domain Monitoring Microservice

API-driven headless service for monitoring merchant web presence with multi-provider support and real-time updates.

## Features

- **User Management**: Self-managed JWT authentication with refresh tokens
- **Multi-Provider**: Pluggable provider architecture (TrueBiz primary)
- **Real-Time Updates**: Server-Sent Events (SSE) for instant notifications
- **Webhooks**: Configurable webhook delivery with HMAC signatures
- **Domain Monitoring**: Track domains with configurable check frequencies

## Tech Stack

- **Runtime**: Node.js 24 LTS
- **Framework**: Express.js
- **Database**: MySQL 8.4
- **Auth**: JWT + bcrypt
- **Validation**: Joi
- **Logging**: Pino
- **Testing**: Jest + Supertest

## Prerequisites

- Node.js 24 or higher
- MySQL 8.4
- npm or yarn

## Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Update .env with your database credentials
```

## Database Setup

```bash
# Create database
mysql -u root -p
CREATE DATABASE domain_monitor;

# Run migrations
npm run migrate
```

## Development

```bash
# Start development server with auto-reload
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Lint code
npm run lint
```

## Production

```bash
# Start production server
npm start
```

## API Documentation

See [docs/PRD.md](docs/PRD.md) for complete API specification.

### Base URL
```
http://localhost:3000/api/v1
```

### Quick Start

1. Register a user:
```bash
POST /api/v1/auth/register
{
  "email": "user@example.com",
  "password": "SecurePass123",
  "name": "John Doe"
}
```

2. Login:
```bash
POST /api/v1/auth/login
{
  "email": "user@example.com",
  "password": "SecurePass123"
}
```

3. Add a domain (with JWT token):
```bash
POST /api/v1/domains
Authorization: Bearer <your_jwt_token>
{
  "domain": "example.com",
  "checkFrequency": "daily"
}
```

## Project Structure

```
domain-monitor/
├── src/
│   ├── server.js              # Entry point
│   ├── app.js                 # Express app setup
│   ├── config/                # Configuration
│   ├── routes/                # Route definitions
│   ├── controllers/           # Request handlers
│   ├── services/              # Business logic
│   ├── repositories/          # Database queries
│   ├── validators/            # Joi schemas
│   ├── middlewares/           # Express middleware
│   └── utils/                 # Utilities
├── migrations/                # Database migrations
├── tests/                     # Test files
└── docs/                      # Documentation
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| NODE_ENV | Environment (development/production) | development |
| PORT | Server port | 3000 |
| DB_HOST | MySQL host | localhost |
| DB_USER | MySQL user | root |
| DB_PASSWORD | MySQL password | - |
| DB_NAME | MySQL database name | domain_monitor |
| JWT_SECRET | JWT signing secret | - |
| LOG_LEVEL | Logging level | info |

## License

ISC
