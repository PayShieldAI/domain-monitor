#!/bin/bash

# Docker Run Script - Blue/Green Deployment
# Manages production-style Docker containers with zero-downtime deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load environment variables from .env
if [ -f ".env" ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Blue/Green configuration
STATE_FILE=".deployment-state"
BLUE_PORT="${BLUE_PORT:-3001}"
GREEN_PORT="${GREEN_PORT:-3002}"

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

# Blue/Green helper functions
get_live_env() {
    if [ -f "$STATE_FILE" ]; then
        cat "$STATE_FILE"
    else
        echo "none"
    fi
}

set_live_env() {
    echo "$1" > "$STATE_FILE"
}

get_other_env() {
    local current=$(get_live_env)
    if [ "$current" = "blue" ]; then
        echo "green"
    else
        echo "blue"
    fi
}

get_env_port() {
    if [ "$1" = "blue" ]; then
        echo "$BLUE_PORT"
    else
        echo "$GREEN_PORT"
    fi
}

# Function to check if .env exists
check_env_file() {
    if [ ! -f .env ]; then
        print_error ".env file not found!"
        print_info "Please create .env from .env.example:"
        print_info "  cp .env.example .env"
        exit 1
    fi
}

# Show blue/green status
status() {
    local live=$(get_live_env)
    local blue_status="stopped"
    local green_status="stopped"

    if docker ps --format '{{.Names}}' | grep -q "domain-monitor-blue"; then
        blue_status="running on port $BLUE_PORT"
    fi
    if docker ps --format '{{.Names}}' | grep -q "domain-monitor-green"; then
        green_status="running on port $GREEN_PORT"
    fi

    echo ""
    echo -e "${CYAN}=== Blue/Green Deployment Status ===${NC}"
    echo ""
    if [ "$live" = "blue" ]; then
        echo -e "  ${BLUE}BLUE${NC}:  $blue_status ${GREEN}[LIVE]${NC}"
    else
        echo -e "  ${BLUE}BLUE${NC}:  $blue_status"
    fi
    if [ "$live" = "green" ]; then
        echo -e "  ${GREEN}GREEN${NC}: $green_status ${GREEN}[LIVE]${NC}"
    else
        echo -e "  ${GREEN}GREEN${NC}: $green_status"
    fi
    echo ""
    echo -e "  Live environment: ${YELLOW}$live${NC}"
    echo ""
}

# Deploy to specific environment (blue or green)
deploy() {
    local target_env="$1"
    local target_port=$(get_env_port "$target_env")

    if [ -z "$target_env" ]; then
        # Auto-select: deploy to non-live environment
        target_env=$(get_other_env)
        target_port=$(get_env_port "$target_env")
    fi

    if [ "$target_env" != "blue" ] && [ "$target_env" != "green" ]; then
        print_error "Invalid environment. Use 'blue' or 'green'"
        exit 1
    fi

    print_info "Deploying to $target_env environment (port $target_port)..."

    # Build and start using blue/green compose file (no volumes)
    PORT=$target_port docker compose -f docker-compose.uat.yml -p "domain-monitor-$target_env" build
    PORT=$target_port docker compose -f docker-compose.uat.yml -p "domain-monitor-$target_env" up -d

    print_info "Waiting for container to be healthy..."
    sleep 5

    # Health check
    if curl -sf "http://localhost:$target_port/health" > /dev/null 2>&1; then
        print_info "$target_env environment is healthy!"
        echo ""
        print_info "To switch traffic to $target_env, run:"
        echo "  ./docker-run.sh switch $target_env"
    else
        print_warning "$target_env environment may not be ready. Check logs:"
        echo "  ./docker-run.sh logs $target_env"
    fi
}

# Switch live traffic to specified environment
switch_env() {
    local target_env="$1"
    local current_live=$(get_live_env)

    if [ -z "$target_env" ]; then
        print_error "Please specify environment: blue or green"
        exit 1
    fi

    if [ "$target_env" != "blue" ] && [ "$target_env" != "green" ]; then
        print_error "Invalid environment. Use 'blue' or 'green'"
        exit 1
    fi

    local target_port=$(get_env_port "$target_env")

    # Check if target is running
    if ! docker ps --format '{{.Names}}' | grep -q "domain-monitor-$target_env"; then
        print_error "$target_env environment is not running!"
        print_info "Deploy first: ./docker-run.sh deploy $target_env"
        exit 1
    fi

    print_info "Switching live traffic from $current_live to $target_env..."

    # Update state file
    set_live_env "$target_env"

    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}  Traffic switched to $target_env (port $target_port)${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    print_info "Update your reverse proxy/load balancer to point to port $target_port"
    echo ""

    status
}

# Rollback to previous environment
rollback() {
    local current=$(get_live_env)
    local previous=$(get_other_env)

    if [ "$current" = "none" ]; then
        print_error "No deployment to rollback from"
        exit 1
    fi

    # Check if previous environment is running
    if ! docker ps --format '{{.Names}}' | grep -q "domain-monitor-$previous"; then
        print_error "Previous environment ($previous) is not running!"
        exit 1
    fi

    print_warning "Rolling back from $current to $previous..."
    switch_env "$previous"
    print_info "Rollback complete!"
}

# Show logs for specific environment
logs() {
    local target_env="$1"
    local lines="$2"

    if [ -z "$target_env" ]; then
        target_env=$(get_live_env)
        if [ "$target_env" = "none" ]; then
            print_error "No live environment. Specify: blue or green"
            exit 1
        fi
    fi

    if [ "$target_env" != "blue" ] && [ "$target_env" != "green" ]; then
        print_error "Invalid environment. Use 'blue' or 'green'"
        exit 1
    fi

    if [ -z "$lines" ]; then
        print_info "Showing logs for $target_env (Ctrl+C to exit)..."
        docker compose -f docker-compose.uat.yml -p "domain-monitor-$target_env" logs -f app
    else
        print_info "Showing last $lines lines for $target_env..."
        docker compose -f docker-compose.uat.yml -p "domain-monitor-$target_env" logs --tail="$lines" app
    fi
}

# Stop specific environment
stop() {
    local target_env="$1"

    if [ -z "$target_env" ]; then
        print_error "Please specify environment: blue or green"
        exit 1
    fi

    if [ "$target_env" != "blue" ] && [ "$target_env" != "green" ]; then
        print_error "Invalid environment. Use 'blue' or 'green'"
        exit 1
    fi

    local live=$(get_live_env)
    if [ "$target_env" = "$live" ]; then
        print_warning "Stopping the LIVE environment!"
        read -p "Are you sure? (y/N) " -r
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Cancelled"
            exit 0
        fi
    fi

    print_info "Stopping $target_env environment..."
    docker compose -f docker-compose.uat.yml -p "domain-monitor-$target_env" down
    print_info "$target_env stopped"
}

# Clean up all blue/green resources
clean() {
    print_warning "This will remove all blue/green containers. Are you sure? (y/N)"
    read -r response
    if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
        print_info "Cleaning up Docker resources..."
        docker compose -f docker-compose.uat.yml -p domain-monitor-blue down -v 2>/dev/null || true
        docker compose -f docker-compose.uat.yml -p domain-monitor-green down -v 2>/dev/null || true
        rm -f "$STATE_FILE"
        print_info "Cleanup complete!"
    else
        print_info "Cleanup cancelled"
    fi
}

# Run migrations on specific environment
migrate() {
    local target_env="$1"

    if [ -z "$target_env" ]; then
        target_env=$(get_live_env)
        if [ "$target_env" = "none" ]; then
            print_error "No live environment. Specify: blue or green"
            exit 1
        fi
    fi

    print_info "Running migrations on $target_env..."
    docker compose -f docker-compose.uat.yml -p "domain-monitor-$target_env" exec app node migrations/migrate.js
    print_info "Migrations complete!"
}

# Function to show usage
usage() {
    cat << EOF
Docker Run Script - Blue/Green Deployment for domain-monitor

Usage: ./docker-run.sh [command]

Commands:
  status              Show blue/green deployment status
  deploy [env]        Deploy to environment (auto-selects idle if not specified)
  switch <env>        Switch live traffic to blue or green
  rollback            Rollback to previous environment
  logs <env> [n]      Show logs for blue or green (optional: last n lines)
  stop <env>          Stop blue or green environment
  migrate [env]       Run migrations on environment (defaults to live)
  clean               Remove all blue/green containers
  help                Show this help message

Examples:
  ./docker-run.sh status              # Check current state
  ./docker-run.sh deploy              # Deploy to idle environment
  ./docker-run.sh deploy blue         # Deploy specifically to blue
  ./docker-run.sh switch green        # Switch traffic to green
  ./docker-run.sh rollback            # Rollback to previous
  ./docker-run.sh logs blue 50        # Show last 50 lines of blue logs

Workflow:
  1. ./docker-run.sh deploy           # Deploy to idle (e.g., blue)
  2. Test on http://localhost:3001    # Verify deployment
  3. ./docker-run.sh switch blue      # Switch traffic
  4. ./docker-run.sh stop green       # Stop old environment (optional)

  If issues:
  ./docker-run.sh rollback            # Quick rollback

EOF
}

# Check if .env exists for commands that need it
case "$1" in
    help|--help|-h|"")
        ;;
    *)
        check_env_file
        ;;
esac

# Parse command
case "$1" in
    status)
        status
        ;;
    deploy)
        deploy "$2"
        ;;
    switch)
        switch_env "$2"
        ;;
    rollback)
        rollback
        ;;
    logs)
        logs "$2" "$3"
        ;;
    stop)
        stop "$2"
        ;;
    migrate)
        migrate "$2"
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
