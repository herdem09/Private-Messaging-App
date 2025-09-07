#!/bin/bash

# ServerChat Database Setup Script
# This script sets up MongoDB and Redis for ServerChat

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="serverchat-main"
MONGO_ROOT_PASSWORD="secure_admin_password_123"
REDIS_PASSWORD="redis_password_123"

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
    echo "ServerChat Database Setup Tool"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  setup               Set up databases (MongoDB + Redis)"
    echo "  start               Start database services"
    echo "  stop                Stop database services"
    echo "  restart             Restart database services"
    echo "  status              Show database status"
    echo "  logs                Show database logs"
    echo "  shell               Open MongoDB shell"
    echo "  redis-cli           Open Redis CLI"
    echo "  backup              Create database backup"
    echo "  restore [FILE]      Restore from backup"
    echo "  reset               Reset all data (WARNING: destructive)"
    echo "  help                Show this help message"
    echo ""
    echo "Options:"
    echo "  --profile PROFILE   Docker compose profile (default: all)"
    echo "  --env-file FILE     Environment file (default: .env)"
    echo ""
    echo "Examples:"
    echo "  $0 setup"
    echo "  $0 start --profile admin-tools"
    echo "  $0 backup"
    echo "  $0 logs mongodb-primary"
}

check_requirements() {
    log_info "Checking requirements..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    log_success "Requirements check passed"
}

create_directories() {
    log_info "Creating necessary directories..."
    
    mkdir -p backups
    mkdir -p monitoring
    mkdir -p logs
    
    log_success "Directories created"
}

create_env_file() {
    if [[ ! -f .env ]]; then
        log_info "Creating .env file..."
        
        cat > .env << EOF
# MongoDB Configuration
MONGO_ROOT_PASSWORD=$MONGO_ROOT_PASSWORD
MONGO_EXPRESS_USER=admin
MONGO_EXPRESS_PASS=admin123

# Redis Configuration
REDIS_PASSWORD=$REDIS_PASSWORD
REDIS_COMMANDER_USER=admin
REDIS_COMMANDER_PASS=admin123

# Backup Configuration
BACKUP_RETENTION_DAYS=30
BACKUP_SCHEDULE=0 2 * * *

# Monitoring
ENABLE_MONITORING=true
STATS_INTERVAL=300
EOF
        
        log_success "Environment file created"
    else
        log_info "Environment file already exists"
    fi
}

setup_databases() {
    log_info "Setting up ServerChat databases..."
    
    check_requirements
    create_directories
    create_env_file
    
    log_info "Starting database services..."
    docker-compose -f docker-compose.db.yml up -d mongodb-primary redis
    
    log_info "Waiting for databases to be ready..."
    sleep 30
    
    # Check MongoDB
    if docker-compose -f docker-compose.db.yml exec -T mongodb-primary mongosh --eval "db.runCommand('ping')" &>/dev/null; then
        log_success "MongoDB is ready"
    else
        log_error "MongoDB failed to start"
        exit 1
    fi
    
    # Check Redis
    if docker-compose -f docker-compose.db.yml exec -T redis redis-cli ping &>/dev/null; then
        log_success "Redis is ready"
    else
        log_error "Redis failed to start"
        exit 1
    fi
    
    log_success "Database setup completed successfully"
    log_info "MongoDB is available at: mongodb://localhost:27017"
    log_info "Redis is available at: redis://localhost:6379"
}

start_services() {
    local profile="${1:-}"
    local cmd="docker-compose -f docker-compose.db.yml up -d"
    
    if [[ -n "$profile" ]]; then
        cmd="$cmd --profile $profile"
    fi
    
    log_info "Starting database services..."
    eval "$cmd"
    log_success "Services started"
}

stop_services() {
    log_info "Stopping database services..."
    docker-compose -f docker-compose.db.yml down
    log_success "Services stopped"
}

restart_services() {
    log_info "Restarting database services..."
    docker-compose -f docker-compose.db.yml restart
    log_success "Services restarted"
}

show_status() {
    log_info "Database service status:"
    docker-compose -f docker-compose.db.yml ps
    
    echo ""
    log_info "MongoDB status:"
    if docker-compose -f docker-compose.db.yml exec -T mongodb-primary mongosh --eval "db.runCommand('ping')" &>/dev/null; then
        echo "✅ MongoDB is running"
        docker-compose -f docker-compose.db.yml exec -T mongodb-primary mongosh --eval "
            print('Database: $DB_NAME');
            print('Collections: ' + db.getSiblingDB('$DB_NAME').getCollectionNames().length);
            print('Total documents: ' + db.getSiblingDB('$DB_NAME').servers.countDocuments());
        " 2>/dev/null || echo "❌ Cannot connect to MongoDB"
    else
        echo "❌ MongoDB is not running"
    fi
    
    echo ""
    log_info "Redis status:"
    if docker-compose -f docker-compose.db.yml exec -T redis redis-cli ping &>/dev/null; then
        echo "✅ Redis is running"
        local redis_info=$(docker-compose -f docker-compose.db.yml exec -T redis redis-cli info server | grep "redis_version\|uptime_in_seconds" | tr '\r' ' ')
        echo "$redis_info"
    else
        echo "❌ Redis is not running"
    fi
}

show_logs() {
    local service="${1:-}"
    
    if [[ -n "$service" ]]; then
        docker-compose -f docker-compose.db.yml logs -f "$service"
    else
        docker-compose -f docker-compose.db.yml logs -f
    fi
}

open_mongo_shell() {
    log_info "Opening MongoDB shell..."
    docker-compose -f docker-compose.db.yml exec mongodb-primary mongosh -u admin -p "$MONGO_ROOT_PASSWORD" --authenticationDatabase admin "$DB_NAME"
}

open_redis_cli() {
    log_info "Opening Redis CLI..."
    docker-compose -f docker-compose.db.yml exec redis redis-cli -a "$REDIS_PASSWORD"
}

create_backup() {
    log_info "Creating database backup..."
    
    if [[ ! -f ./backup-restore.sh ]]; then
        log_error "Backup script not found"
        exit 1
    fi
    
    docker-compose -f docker-compose.db.yml exec mongodb-primary /bin/bash -c "
        cd /backups && 
        /usr/local/bin/backup-restore.sh backup --compress --host mongodb-primary --user admin --password $MONGO_ROOT_PASSWORD
    "
    
    log_success "Backup completed"
}

restore_backup() {
    local backup_file="$1"
    
    if [[ -z "$backup_file" ]]; then
        log_error "Backup file not specified"
        exit 1
    fi
    
    log_warning "This will restore the database from: $backup_file"
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Restore cancelled"
        exit 0
    fi
    
    log_info "Restoring database..."
    
    docker-compose -f docker-compose.db.yml exec mongodb-primary /bin/bash -c "
        cd /backups && 
        /usr/local/bin/backup-restore.sh restore $backup_file --host mongodb-primary --user admin --password $MONGO_ROOT_PASSWORD
    "
    
    log_success "Restore completed"
}

reset_databases() {
    log_error "WARNING: This will delete ALL data in the databases!"
    log_warning "This action cannot be undone!"
    
    read -p "Type 'DELETE ALL DATA' to confirm: " -r
    
    if [[ "$REPLY" != "DELETE ALL DATA" ]]; then
        log_info "Reset cancelled"
        exit 0
    fi
    
    log_info "Stopping services..."
    docker-compose -f docker-compose.db.yml down
    
    log_info "Removing volumes..."
    docker volume rm -f $(docker volume ls -q | grep serverchat)
    
    log_info "Removing containers..."
    docker container rm -f $(docker container ls -aq --filter name=serverchat)
    
    log_success "All data has been deleted"
    log_info "Run '$0 setup' to initialize fresh databases"
}

# Main script logic
case "${1:-help}" in
    setup)
        setup_databases
        ;;
    start)
        start_services "${2:-}"
        ;;
    stop)
        stop_services
        ;;
    restart)
        restart_services
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs "${2:-}"
        ;;
    shell)
        open_mongo_shell
        ;;
    redis-cli)
        open_redis_cli
        ;;
    backup)
        create_backup
        ;;
    restore)
        restore_backup "$2"
        ;;
    reset)
        reset_databases
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