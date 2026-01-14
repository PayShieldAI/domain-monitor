@echo off
echo ===================================
echo Domain Monitor - Docker Setup
echo ===================================

REM Build and start containers
echo Starting containers...
docker-compose up -d

REM Wait for MySQL to be ready
echo Waiting for MySQL to be ready...
timeout /t 15 /nobreak > nul

REM Run migrations
echo Running database migrations...
docker-compose exec app npm run migrate

echo.
echo ===================================
echo Setup complete!
echo ===================================
echo.
echo API is running at: http://localhost:3000
echo.
echo Test endpoints:
echo   Health check:  curl http://localhost:3000/health
echo.
echo Useful commands:
echo   View logs:     docker-compose logs -f app
echo   Stop:          docker-compose down
echo   MySQL shell:   docker-compose exec mysql mysql -u root -pdevpassword123 domain_monitor
echo.
