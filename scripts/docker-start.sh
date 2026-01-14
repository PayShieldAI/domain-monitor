#!/bin/bash

echo "==================================="
echo "Domain Monitor - Docker Setup"
echo "==================================="

# Build and start containers
echo "Starting containers..."
docker-compose up -d

# Wait for MySQL to be ready
echo "Waiting for MySQL to be ready..."
sleep 10

# Run migrations
echo "Running database migrations..."
docker-compose exec app npm run migrate

echo ""
echo "==================================="
echo "Setup complete!"
echo "==================================="
echo ""
echo "API is running at: http://localhost:3000"
echo ""
echo "Test endpoints:"
echo "  Health check:  curl http://localhost:3000/health"
echo "  Register:      curl -X POST http://localhost:3000/api/v1/auth/register -H 'Content-Type: application/json' -d '{\"email\":\"test@example.com\",\"password\":\"Test1234\",\"name\":\"Test User\"}'"
echo ""
echo "Useful commands:"
echo "  View logs:     docker-compose logs -f app"
echo "  Stop:          docker-compose down"
echo "  MySQL shell:   docker-compose exec mysql mysql -u root -pdevpassword123 domain_monitor"
echo ""
