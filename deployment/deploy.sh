#!/bin/bash

# ServerChat Deployment Script
# Automated deployment for production environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DEPLOYMENT_ENV=${DEPLOYMENT_ENV:-production}
COMPOSE_FILE=${COMPOSE_FILE:-docker-compose.full.yml}
BACKUP_BEFORE_DEPLOY=${BACKUP_BEFORE_DEPLOY:-true}
HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-300}
ROLLBACK_ON_FAILURE=${ROLLBACK_ON_FAILURE:-true}

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_help() {
    echo "ServerChat Deployment Tool"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  deploy              Deploy the application"
    echo "  rollback            Rollback to previous version"
    echo "  status              Show deployment status"
    echo "  logs                Show service logs"
    echo "  backup              Create backup before deployment"
    echo "  health              Check service health"
    echo "  scale [SERVICE] [N] Scale service to N replicas"
    echo "  restart [SERVICE]   Restart service(s)"
    echo "  stop                Stop all services"
    echo "  start               Start all services"
    echo "  help                Show this help message"
    echo ""
    echo "Options:"
    echo "  --env ENV           Deployment environment (default: production)"
    echo "  --compose-file FILE Docker compose file (default: docker-compose.full.yml)"
    echo "  --no-backup         Skip backup before deployment"
    echo "  --no-rollback       Don't rollback on failure"
    echo "  --timeout SECONDS   Health check timeout (default: 300)"
    echo "  --profile PROFILE   Docker compose profile"
    echo ""
    echo "Examples:"
    echo "  $0 deploy --env staging"
    echo "  $0 rollback"
    echo "  $0 scale chat-server-general 3"
    echo "  $0 logs main-server"
}

check_requirements() {
    log_info "Checking deployment requirements..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check compose file
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        log_error "Compose file not found: $COMPOSE_FILE"
        exit 1
    fi
    
    # Check environment file
    if [[ ! -f ".env.${DEPLOYMENT_ENV}" ]]; then
        log_warning "Environment file not found: .env.${DEPLOYMENT_ENV}"
        log_info "Using default .env file"
    fi
    
    log_success "Requirements check passed"
}

create_backup() {
    if [[ "$BACKUP_BEFORE_DEPLOY" == "true" ]]; then
        log_info "Creating backup before deployment..."
        
        if docker-compose -f "$COMPOSE_FILE" exec -T mongodb mongodump --version &>/dev/null; then
            local timestamp=$(date +%Y%m%d_%H%M%S)
            local backup_dir="./backups/pre-deploy-${timestamp}"
            
            mkdir -p "$backup_dir"
            
            if docker-compose -f "$COMPOSE_FILE" exec -T mongodb mongodump \
                --host mongodb:27017 \
                --db serverchat-main \
                --archive="/backups/pre-deploy-${timestamp}.archive.gz" \
                --gzip; then
                
                log_success "Backup created: pre-deploy-${timestamp}.archive.gz"
                echo "$timestamp" > .last-backup
            else
                log_error "Backup failed"
                exit 1
            fi
        else
            log_warning "Cannot create backup - MongoDB not accessible"
        fi
    else
        log_info "Skipping backup (disabled)"
    fi
}

deploy_application() {
    log_info "Starting deployment..."
    
    # Set environment file
    local env_file=".env"
    if [[ -f ".env.${DEPLOYMENT_ENV}" ]]; then
        env_file=".env.${DEPLOYMENT_ENV}"
    fi
    
    # Pull latest images
    log_info "Pulling latest images..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$env_file" pull
    
    # Build custom images
    log_info "Building custom images..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$env_file" build
    
    # Start services
    log_info "Starting services..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$env_file" up -d
    
    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    if wait_for_health; then
        log_success "Deployment completed successfully"
        
        # Save deployment info
        save_deployment_info
        
        return 0
    else
        log_error "Deployment failed - services are not healthy"
        
        if [[ "$ROLLBACK_ON_FAILURE" == "true" ]]; then
            log_warning "Rolling back..."
            rollback_deployment
        fi
        
        return 1
    fi
}

wait_for_health() {
    local timeout=$HEALTH_CHECK_TIMEOUT
    local elapsed=0
    local interval=10
    
    log_info "Performing health checks (timeout: ${timeout}s)..."
    
    while [[ $elapsed -lt $timeout ]]; do
        local healthy=true
        
        # Check main server
        if ! curl -f -s http://localhost:3000/api/health >/dev/null 2>&1; then
            healthy=false
        fi
        
        # Check chat servers
        for port in 8080 8081 8082; do
            if ! curl -f -s http://localhost:${port}/api/health >/dev/null 2>&1; then
                healthy=false
                break
            fi
        done
        
        if [[ "$healthy" == "true" ]]; then
            log_success "All services are healthy"
            return 0
        fi
        
        log_info "Waiting for services to be ready... (${elapsed}s/${timeout}s)"
        sleep $interval
        elapsed=$((elapsed + interval))
    done
    
    log_error "Health check timeout reached"
    return 1
}

save_deployment_info() {
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)
    local commit_hash=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
    local branch=$(git branch --show-current 2>/dev/null || echo "unknown")
    
    cat > .deployment-info << EOF
{
  "timestamp": "$timestamp",
  "environment": "$DEPLOYMENT_ENV",
  "commit_hash": "$commit_hash",
  "branch": "$branch",
  "compose_file": "$COMPOSE_FILE",
  "deployed_by": "$(whoami)",
  "host": "$(hostname)"
}
EOF
    
    log_info "Deployment info saved"
}

rollback_deployment() {
    log_info "Starting rollback..."
    
    if [[ ! -f ".last-backup" ]]; then
        log_error "No backup information found for rollback"
        return 1
    fi
    
    local backup_timestamp=$(cat .last-backup)
    local backup_file="./backups/pre-deploy-${backup_timestamp}.archive.gz"
    
    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: $backup_file"
        return 1
    fi
    
    # Stop current services
    log_info "Stopping current services..."
    docker-compose -f "$COMPOSE_FILE" down
    
    # Restore database
    log_info "Restoring database from backup..."
    if docker run --rm \
        --network serverchat-network \
        -v "$(pwd)/backups:/backups" \
        mongo:6.0 \
        mongorestore \
        --host mongodb:27017 \
        --db serverchat-main \
        --drop \
        --archive="/backups/pre-deploy-${backup_timestamp}.archive.gz" \
        --gzip; then
        
        log_success "Database restored successfully"
    else
        log_error "Database restore failed"
        return 1
    fi
    
    # Start services
    log_info "Starting services after rollback..."
    docker-compose -f "$COMPOSE_FILE" up -d
    
    if wait_for_health; then
        log_success "Rollback completed successfully"
        return 0
    else
        log_error "Rollback failed"
        return 1
    fi
}

show_status() {
    log_info "Deployment status:"
    
    # Show container status
    docker-compose -f "$COMPOSE_FILE" ps
    
    echo ""
    log_info "Service health:"
    
    # Check main server
    if curl -f -s http://localhost:3000/api/health >/dev/null 2>&1; then
        echo "✅ Main Server (port 3000)"
    else
        echo "❌ Main Server (port 3000)"
    fi
    
    # Check chat servers
    for port in 8080 8081 8082; do
        local server_name=""
        case $port in
            8080) server_name="General Chat" ;;
            8081) server_name="Gaming Hub" ;;
            8082) server_name="Study Group" ;;
        esac
        
        if curl -f -s http://localhost:${port}/api/health >/dev/null 2>&1; then
            echo "✅ $server_name (port $port)"
        else
            echo "❌ $server_name (port $port)"
        fi
    done
    
    # Show deployment info if available
    if [[ -f ".deployment-info" ]]; then
        echo ""
        log_info "Last deployment:"
        cat .deployment-info | jq -r '
            "Timestamp: " + .timestamp + "\n" +
            "Environment: " + .environment + "\n" +
            "Commit: " + .commit_hash + "\n" +
            "Branch: " + .branch + "\n" +
            "Deployed by: " + .deployed_by
        ' 2>/dev/null || cat .deployment-info
    fi
}

show_logs() {
    local service="${1:-}"
    local lines="${2:-100}"
    
    if [[ -n "$service" ]]; then
        docker-compose -f "$COMPOSE_FILE" logs --tail="$lines" -f "$service"
    else
        docker-compose -f "$COMPOSE_FILE" logs --tail="$lines" -f
    fi
}

scale_service() {
    local service="$1"
    local replicas="$2"
    
    if [[ -z "$service" || -z "$replicas" ]]; then
        log_error "Usage: $0 scale <service> <replicas>"
        exit 1
    fi
    
    log_info "Scaling $service to $replicas replicas..."
    
    if docker-compose -f "$COMPOSE_FILE" up -d --scale "$service=$replicas" "$service"; then
        log_success "Service scaled successfully"
    else
        log_error "Failed to scale service"
        exit 1
    fi
}

restart_service() {
    local service="${1:-}"
    
    if [[ -n "$service" ]]; then
        log_info "Restarting service: $service"
        docker-compose -f "$COMPOSE_FILE" restart "$service"
    else
        log_info "Restarting all services"
        docker-compose -f "$COMPOSE_FILE" restart
    fi
    
    log_success "Service(s) restarted"
}

stop_services() {
    log_info "Stopping all services..."
    docker-compose -f "$COMPOSE_FILE" down
    log_success "All services stopped"
}

start_services() {
    log_info "Starting all services..."
    docker-compose -f "$COMPOSE_FILE" up -d
    
    if wait_for_health; then
        log_success "All services started and healthy"
    else
        log_error "Some services failed to start properly"
        exit 1
    fi
}

check_health() {
    log_info "Performing health checks..."
    
    local healthy=true
    
    # Check main server
    if curl -f -s http://localhost:3000/api/health/detailed >/dev/null 2>&1; then
        log_success "Main Server is healthy"
    else
        log_error "Main Server is unhealthy"
        healthy=false
    fi
    
    # Check chat servers
    for port in 8080 8081 8082; do
        local server_name=""
        case $port in
            8080) server_name="General Chat" ;;
            8081) server_name="Gaming Hub" ;;
            8082) server_name="Study Group" ;;
        esac
        
        if curl -f -s http://localhost:${port}/api/health/detailed >/dev/null 2>&1; then
            log_success "$server_name is healthy"
        else
            log_error "$server_name is unhealthy"
            healthy=false
        fi
    done
    
    # Check database
    if docker-compose -f "$COMPOSE_FILE" exec -T mongodb mongosh --eval "db.runCommand('ping')" --quiet >/dev/null 2>&1; then
        log_success "MongoDB is healthy"
    else
        log_error "MongoDB is unhealthy"
        healthy=false
    fi
    
    if [[ "$healthy" == "true" ]]; then
        log_success "All services are healthy"
        exit 0
    else
        log_error "Some services are unhealthy"
        exit 1
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --env)
            DEPLOYMENT_ENV="$2"
            shift 2
            ;;
        --compose-file)
            COMPOSE_FILE="$2"
            shift 2
            ;;
        --no-backup)
            BACKUP_BEFORE_DEPLOY=false
            shift
            ;;
        --no-rollback)
            ROLLBACK_ON_FAILURE=false
            shift
            ;;
        --timeout)
            HEALTH_CHECK_TIMEOUT="$2"
            shift 2
            ;;
        --profile)
            export COMPOSE_PROFILES="$2"
            shift 2
            ;;
        *)
            break
            ;;
    esac
done

# Main command handling
case "${1:-help}" in
    deploy)
        check_requirements
        create_backup
        deploy_application
        ;;
    rollback)
        check_requirements
        rollback_deployment
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs "$2" "$3"
        ;;
    backup)
        create_backup
        ;;
    health)
        check_health
        ;;
    scale)
        scale_service "$2" "$3"
        ;;
    restart)
        restart_service "$2"
        ;;
    stop)
        stop_services
        ;;
    start)
        start_services
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        log_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac