#!/bin/bash

# ServerChat Database Backup and Restore Script
# Usage: ./backup-restore.sh [backup|restore] [options]

set -e

# Configuration
DB_NAME="serverchat-main"
DB_HOST="localhost"
DB_PORT="27017"
DB_USER="serverchat_admin"
DB_PASS="secure_password_123"
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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
    echo "ServerChat Database Backup and Restore Tool"
    echo ""
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  backup              Create a backup of the database"
    echo "  restore [FILE]      Restore database from backup file"
    echo "  list               List available backups"
    echo "  clean              Clean old backups (older than 30 days)"
    echo "  help               Show this help message"
    echo ""
    echo "Options:"
    echo "  --host HOST        MongoDB host (default: localhost)"
    echo "  --port PORT        MongoDB port (default: 27017)"
    echo "  --user USER        MongoDB username"
    echo "  --password PASS    MongoDB password"
    echo "  --db DATABASE      Database name (default: serverchat-main)"
    echo "  --dir DIRECTORY    Backup directory (default: ./backups)"
    echo "  --compress         Compress backup with gzip"
    echo "  --quiet           Suppress output"
    echo ""
    echo "Examples:"
    echo "  $0 backup --compress"
    echo "  $0 restore backups/serverchat-main_20231201_120000.bson"
    echo "  $0 list"
    echo "  $0 clean"
}

create_backup() {
    local compress_flag=""
    local quiet_flag=""
    
    # Parse options
    while [[ $# -gt 0 ]]; do
        case $1 in
            --compress)
                compress_flag="--gzip"
                shift
                ;;
            --quiet)
                quiet_flag="--quiet"
                shift
                ;;
            --host)
                DB_HOST="$2"
                shift 2
                ;;
            --port)
                DB_PORT="$2"
                shift 2
                ;;
            --user)
                DB_USER="$2"
                shift 2
                ;;
            --password)
                DB_PASS="$2"
                shift 2
                ;;
            --db)
                DB_NAME="$2"
                shift 2
                ;;
            --dir)
                BACKUP_DIR="$2"
                shift 2
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    # Create backup directory if it doesn't exist
    mkdir -p "$BACKUP_DIR"
    
    local backup_file="${BACKUP_DIR}/${DB_NAME}_${DATE}"
    
    if [[ -n "$compress_flag" ]]; then
        backup_file="${backup_file}.archive.gz"
    else
        backup_file="${backup_file}.archive"
    fi
    
    log_info "Starting backup of database: $DB_NAME"
    log_info "Backup file: $backup_file"
    
    # Build mongodump command
    local cmd="mongodump"
    cmd="$cmd --host ${DB_HOST}:${DB_PORT}"
    cmd="$cmd --db $DB_NAME"
    
    if [[ -n "$DB_USER" ]]; then
        cmd="$cmd --username $DB_USER"
    fi
    
    if [[ -n "$DB_PASS" ]]; then
        cmd="$cmd --password $DB_PASS"
    fi
    
    cmd="$cmd --archive=$backup_file"
    
    if [[ -n "$compress_flag" ]]; then
        cmd="$cmd $compress_flag"
    fi
    
    if [[ -n "$quiet_flag" ]]; then
        cmd="$cmd $quiet_flag"
    fi
    
    # Execute backup
    if eval "$cmd"; then
        local file_size=$(du -h "$backup_file" | cut -f1)
        log_success "Backup completed successfully"
        log_info "Backup size: $file_size"
        log_info "Backup location: $backup_file"
        
        # Create metadata file
        cat > "${backup_file}.meta" << EOF
{
  "database": "$DB_NAME",
  "host": "$DB_HOST:$DB_PORT",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
  "size": "$file_size",
  "compressed": $([ -n "$compress_flag" ] && echo "true" || echo "false"),
  "collections": $(mongo --host "$DB_HOST:$DB_PORT" --username "$DB_USER" --password "$DB_PASS" --authenticationDatabase "$DB_NAME" --eval "db.getSiblingDB('$DB_NAME').getCollectionNames().length" --quiet)
}
EOF
        
    else
        log_error "Backup failed"
        exit 1
    fi
}

restore_backup() {
    local backup_file="$1"
    local quiet_flag=""
    
    if [[ -z "$backup_file" ]]; then
        log_error "Backup file not specified"
        show_help
        exit 1
    fi
    
    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: $backup_file"
        exit 1
    fi
    
    # Parse additional options
    shift
    while [[ $# -gt 0 ]]; do
        case $1 in
            --quiet)
                quiet_flag="--quiet"
                shift
                ;;
            --host)
                DB_HOST="$2"
                shift 2
                ;;
            --port)
                DB_PORT="$2"
                shift 2
                ;;
            --user)
                DB_USER="$2"
                shift 2
                ;;
            --password)
                DB_PASS="$2"
                shift 2
                ;;
            --db)
                DB_NAME="$2"
                shift 2
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done
    
    log_warning "This will overwrite the existing database: $DB_NAME"
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Restore cancelled"
        exit 0
    fi
    
    log_info "Starting restore from: $backup_file"
    log_info "Target database: $DB_NAME"
    
    # Build mongorestore command
    local cmd="mongorestore"
    cmd="$cmd --host ${DB_HOST}:${DB_PORT}"
    cmd="$cmd --db $DB_NAME"
    cmd="$cmd --drop" # Drop existing collections before restore
    
    if [[ -n "$DB_USER" ]]; then
        cmd="$cmd --username $DB_USER"
    fi
    
    if [[ -n "$DB_PASS" ]]; then
        cmd="$cmd --password $DB_PASS"
    fi
    
    cmd="$cmd --archive=$backup_file"
    
    # Check if file is compressed
    if [[ "$backup_file" == *.gz ]]; then
        cmd="$cmd --gzip"
    fi
    
    if [[ -n "$quiet_flag" ]]; then
        cmd="$cmd $quiet_flag"
    fi
    
    # Execute restore
    if eval "$cmd"; then
        log_success "Restore completed successfully"
        
        # Show collection counts after restore
        log_info "Restored collections:"
        mongo --host "$DB_HOST:$DB_PORT" --username "$DB_USER" --password "$DB_PASS" --authenticationDatabase "$DB_NAME" --eval "
            db.getSiblingDB('$DB_NAME').getCollectionNames().forEach(function(collection) {
                var count = db.getSiblingDB('$DB_NAME')[collection].countDocuments();
                print('  ' + collection + ': ' + count + ' documents');
            });
        " --quiet
        
    else
        log_error "Restore failed"
        exit 1
    fi
}

list_backups() {
    log_info "Available backups in: $BACKUP_DIR"
    
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log_warning "Backup directory does not exist: $BACKUP_DIR"
        exit 0
    fi
    
    local backups=($(find "$BACKUP_DIR" -name "*.archive*" -type f | sort -r))
    
    if [[ ${#backups[@]} -eq 0 ]]; then
        log_warning "No backups found"
        exit 0
    fi
    
    echo ""
    printf "%-40s %-15s %-10s %-20s\n" "Backup File" "Size" "Type" "Date"
    printf "%-40s %-15s %-10s %-20s\n" "----------" "----" "----" "----"
    
    for backup in "${backups[@]}"; do
        local filename=$(basename "$backup")
        local size=$(du -h "$backup" | cut -f1)
        local type="Standard"
        local date_str=""
        
        if [[ "$filename" == *.gz ]]; then
            type="Compressed"
        fi
        
        # Extract date from filename
        if [[ "$filename" =~ _([0-9]{8}_[0-9]{6}) ]]; then
            local date_part="${BASH_REMATCH[1]}"
            date_str=$(date -d "${date_part:0:8} ${date_part:9:2}:${date_part:11:2}:${date_part:13:2}" "+%Y-%m-%d %H:%M:%S" 2>/dev/null || echo "Unknown")
        fi
        
        printf "%-40s %-15s %-10s %-20s\n" "$filename" "$size" "$type" "$date_str"
        
        # Show metadata if available
        local meta_file="${backup}.meta"
        if [[ -f "$meta_file" ]]; then
            local collections=$(grep -o '"collections": [0-9]*' "$meta_file" | cut -d' ' -f2)
            echo "    Collections: $collections"
        fi
        echo ""
    done
}

clean_old_backups() {
    local days=${1:-30}
    
    log_info "Cleaning backups older than $days days from: $BACKUP_DIR"
    
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log_warning "Backup directory does not exist: $BACKUP_DIR"
        exit 0
    fi
    
    local deleted_count=0
    local total_size=0
    
    while IFS= read -r -d '' file; do
        local size=$(stat -f%z "$file" 2>/dev/null || stat -c%s "$file" 2>/dev/null || echo 0)
        total_size=$((total_size + size))
        deleted_count=$((deleted_count + 1))
        log_info "Deleting: $(basename "$file")"
        rm -f "$file"
        
        # Also delete metadata file if exists
        local meta_file="${file}.meta"
        if [[ -f "$meta_file" ]]; then
            rm -f "$meta_file"
        fi
        
    done < <(find "$BACKUP_DIR" -name "*.archive*" -type f -mtime +$days -print0)
    
    if [[ $deleted_count -gt 0 ]]; then
        local size_mb=$((total_size / 1024 / 1024))
        log_success "Deleted $deleted_count old backups (${size_mb}MB freed)"
    else
        log_info "No old backups found"
    fi
}

# Main script logic
case "${1:-help}" in
    backup)
        shift
        create_backup "$@"
        ;;
    restore)
        shift
        restore_backup "$@"
        ;;
    list)
        list_backups
        ;;
    clean)
        clean_old_backups "${2:-30}"
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