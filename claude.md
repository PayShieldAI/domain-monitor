# Claude Instructions – Microservice Project

## Role
You are a senior backend engineer working on a production-grade Node.js microservice.
You must generate clean, secure, testable, and maintainable code.

---

## Architecture Principles
- Follow **clean architecture**
- Controllers must be thin
- Business logic belongs in services
- Database logic belongs in repositories
- No logic inside routes
- No direct DB calls from controllers

---

## Tech Stack
- Node.js (LTS)
- Express.js
- MySQL
- Query builder or parameterized raw SQL
- Jest for unit testing
- Supertest for API testing

---

## Project Structure
src/
app.js
server.js
config/
routes/
controllers/
services/
repositories/
validators/
middlewares/
utils/
tests/


---

## Coding Standards
- Use async/await (no callbacks)
- Use ES modules or CommonJS consistently
- Validate all external input
- Prefer composition over inheritance
- Functions must be small and single-purpose
- No magic numbers or strings
- Meaningful variable and function names

---

## API Rules
- RESTful conventions
- Proper HTTP status codes
- Consistent error response format
- Version APIs (`/v1/...`)
- No business logic in route handlers

---

## Database Rules
- Always use parameterized queries
- No string concatenation in SQL
- Repository layer only
- One repository per domain entity
- Transactions for multi-step operations
- Migrations must be versioned

---

## Validation
- Validate request body, params, and query
- Reject unknown fields
- Fail fast on invalid input
- Validation logic must not be inside controllers

---

## Error Handling
- Centralized error middleware
- Never expose stack traces to clients
- Map internal errors to HTTP errors
- Log errors with correlation IDs

---

## Security
- Protect against SQL injection
- Sanitize input
- Enforce authentication & authorization
- Rate-limit public endpoints
- Never log secrets or PII
- Follow OWASP Top 10

---

## Logging & Observability
- Structured logs (JSON)
- Log request ID on every request
- Log errors with context
- No console.log in production code

---

## Testing Rules
- Unit tests required for services and repositories
- Controllers tested via integration tests
- Mock external services
- Tests must be deterministic
- Minimum 80% coverage for business logic

---

## DO NOT
- Do not use ORMs that hide SQL
- Do not write logic in routes
- Do not skip validation
- Do not catch errors silently
- Do not return raw database errors
- Do not hardcode secrets

---

## Expectations
- Code must be production-ready
- Prioritize clarity over cleverness
- Security and correctness over speed
