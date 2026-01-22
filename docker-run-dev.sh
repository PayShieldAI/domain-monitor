#!/bin/bash

# Docker Run Development Script
# Manages Docker containers for the domain-monitor application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Function to print colored messages
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to check if .env.local exists
check_env_file() {
    if [ ! -f .env.local ]; then
        print_error ".env.local file not found!"
        print_info "Please create .env.local from .env.example:"
        print_info "  cp .env.example .env.local"
        exit 1
    fi
}

# Function to build containers
build() {
    print_info "Building Docker containers..."
    docker compose build
    print_info "Build complete!"
}

# Function to start containers
start() {
    print_info "Starting Docker containers..."
    docker compose up -d
    sleep 3
    print_info "Containers started!"
    status
}

# Function to stop containers
stop() {
    print_info "Stopping Docker containers..."
    docker compose down
    print_info "Containers stopped!"
}

# Function to restart containers
restart() {
    print_info "Restarting Docker containers..."
    stop
    start
}

# Function to rebuild and restart
rebuild() {
    print_info "Rebuilding and restarting containers..."
    stop
    build
    start
}

# Function to show container status
status() {
    print_info "Container status:"
    docker compose ps
}

# Function to show logs
logs() {
    if [ -z "$1" ]; then
        print_info "Showing logs (press Ctrl+C to exit)..."
        docker compose logs -f app
    else
        print_info "Showing last $1 lines of logs..."
        docker compose logs --tail="$1" app
    fi
}

# Function to execute commands in container
exec_command() {
    if [ -z "$1" ]; then
        print_error "No command provided"
        exit 1
    fi
    print_info "Executing: $@"
    docker compose exec app "$@"
}

# Function to run migrations
migrate() {
    print_info "Running database migrations..."
    docker compose exec app node migrations/migrate.js
    print_info "Migrations complete!"
}

# Function to access container shell
shell() {
    print_info "Opening shell in app container..."
    docker compose exec app /bin/sh
}

# Function to clean up everything
clean() {
    print_warning "This will remove all containers and volumes. Are you sure? (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        print_info "Cleaning up Docker resources..."
        docker compose down -v
        print_info "Cleanup complete!"
    else
        print_info "Cleanup cancelled"
    fi
}

# Function to show usage
usage() {
    cat << EOF
Docker Run Development Script for domain-monitor

Usage: ./docker-run-dev.sh [command]

Commands:
  build         Build Docker containers
  start         Start containers in detached mode
  stop          Stop containers
  restart       Restart containers
  rebuild       Rebuild and restart containers
  status        Show container status
  logs [n]      Show logs (optional: last n lines)
  migrate       Run database migrations
  shell         Open shell in app container
  exec [cmd]    Execute command in app container
  clean         Remove all containers and volumes
  help          Show this help message

Examples:
  ./docker-run-dev.sh build
  ./docker-run-dev.sh start
  ./docker-run-dev.sh logs 50
  ./docker-run-dev.sh migrate
  ./docker-run-dev.sh exec npm test

EOF
}

# Check if .env.local exists for all commands except help
if [ "$1" != "help" ] && [ "$1" != "" ]; then
    check_env_file
fi

# Parse command
case "$1" in
    build)
        build
        ;;
    start)
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    rebuild)
        rebuild
        ;;
    status)
        status
        ;;
    logs)
        logs "$2"
        ;;
    migrate)
        migrate
        ;;
    shell)
        shell
        ;;
    exec)
        shift
        exec_command "$@"
        ;;
    clean)
        clean
        ;;
    help|--help|-h)
        usage
        ;;
    "")
        print_error "No command provided"
        usage
        exit 1
        ;;
    *)
        print_error "Unknown command: $1"
        usage
        exit 1
        ;;
esac
