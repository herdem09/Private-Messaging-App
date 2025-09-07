#!/bin/bash

# ServerChat Backup Script
# Automated backup service for MongoDB and application data

set -e

# Configuration from environment variables
MONGO_HOST=${MONGO_HOST:-mongodb}
MONGO_PORT=${MONGO_PORT:-27017}
MONGO_USER=${MONGO_USER:-admin}
MONGO_PASS=${MONGO_PASS:-secure_password_123}
MONGO_DB=${MONGO_DB:-serverchat-main}
BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
BACKUP_DIR=${BACKUP_DIR:-/backups}
S3_BUCKET=${S3_BUCKET:-}
S3_ACCESS_KEY=${S3_ACCESS_KEY:-}
S3_SECRET_KEY=${S3_SECRET_KEY:-}

# Logging
LOG_FILE="/var/log/backup/backup-$(date +%Y%m%d).log"
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $1" | tee -a "$LOG_FILE" >&2
}

# Create backup
create_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_name="serverchat-backup-${timestamp}"
    local backup_file="${BACKUP_DIR}/${backup_name}.archive.gz"
    local metadata_file="${backup_file}.meta"
    
    log "Starting backup: $backup_name"
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    # MongoDB backup
    log "Creating MongoDB backup..."
    if mongodump \
        --host "${MONGO_HOST}:${MONGO_PORT}" \
        --username "$MONGO_USER" \
        --password "$MONGO_PASS" \
        --authenticationDatabase admin \
        --db "$MONGO_DB" \
        --archive="$backup_file" \
        --gzip; then
        
        log "MongoDB backup completed successfully"
        
        # Create metadata file
        create_metadata "$backup_file" "$metadata_file"
        
        # Upload to S3 if configured
        if [[ -n "$S3_BUCKET" ]]; then
            upload_to_s3 "$backup_file" "$metadata_file"
        fi
        
        # Cleanup old backups
        cleanup_old_backups
        
        log "Backup completed: $backup_file"
        return 0
    else
        log_error "MongoDB backup failed"
        return 1
    fi
}

# Create backup metadata
create_metadata() {
    local backup_file="$1"
    local metadata_file="$2"
    local file_size=$(du -h "$backup_file" | cut -f1)
    
    cat > "$metadata_file" << EOF
{
  "backup_name": "$(basename "$backup_file")",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)",
  "database": "$MONGO_DB",
  "host": "$MONGO_HOST:$MONGO_PORT",
  "size": "$file_size",
  "compressed": true,
  "retention_days": $BACKUP_RETENTION_DAYS,
  "s3_uploaded": $([ -n "$S3_BUCKET" ] && echo "true" || echo "false"),
  "checksum": "$(sha256sum "$backup_file" | cut -d' ' -f1)"
}
EOF
    
    log "Metadata created: $metadata_file"
}

# Upload to S3
upload_to_s3() {
    local backup_file="$1"
    local metadata_file="$2"
    
    if [[ -z "$S3_ACCESS_KEY" || -z "$S3_SECRET_KEY" ]]; then
        log "S3 credentials not configured, skipping upload"
        return 0
    fi
    
    log "Uploading backup to S3: $S3_BUCKET"
    
    # Configure AWS CLI
    export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY"
    export AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY"
    
    # Upload backup file
    if aws s3 cp "$backup_file" "s3://$S3_BUCKET/backups/$(basename "$backup_file")" --storage-class STANDARD_IA; then
        log "Backup file uploaded to S3 successfully"
    else
        log_error "Failed to upload backup file to S3"
        return 1
    fi
    
    # Upload metadata file
    if aws s3 cp "$metadata_file" "s3://$S3_BUCKET/backups/$(basename "$metadata_file")"; then
        log "Metadata file uploaded to S3 successfully"
    else
        log_error "Failed to upload metadata file to S3"
        return 1
    fi
    
    log "S3 upload completed"
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $BACKUP_RETENTION_DAYS days"
    
    local deleted_count=0
    local total_size=0
    
    # Find and delete old local backups
    while IFS= read -r -d '' file; do
        local size=$(stat -c%s "$file" 2>/dev/null || echo 0)
        total_size=$((total_size + size))
        deleted_count=$((deleted_count + 1))
        
        log "Deleting old backup: $(basename "$file")"
        rm -f "$file"
        
        # Also delete metadata file
        local meta_file="${file}.meta"
        if [[ -f "$meta_file" ]]; then
            rm -f "$meta_file"
        fi
        
    done < <(find "$BACKUP_DIR" -name "*.archive.gz" -type f -mtime +$BACKUP_RETENTION_DAYS -print0)
    
    if [[ $deleted_count -gt 0 ]]; then
        local size_mb=$((total_size / 1024 / 1024))
        log "Cleaned up $deleted_count old backups (${size_mb}MB freed)"
    else
        log "No old backups found for cleanup"
    fi
    
    # Cleanup old S3 backups if configured
    if [[ -n "$S3_BUCKET" && -n "$S3_ACCESS_KEY" ]]; then
        cleanup_s3_backups
    fi
}

# Cleanup old S3 backups
cleanup_s3_backups() {
    log "Cleaning up old S3 backups"
    
    export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY"
    export AWS_SECRET_ACCESS_KEY="$S3_SECRET_KEY"
    
    # Calculate cutoff date
    local cutoff_date=$(date -d "$BACKUP_RETENTION_DAYS days ago" +%Y-%m-%d)
    
    # List and delete old backups
    aws s3api list-objects-v2 \
        --bucket "$S3_BUCKET" \
        --prefix "backups/" \
        --query "Contents[?LastModified<='${cutoff_date}T23:59:59.999Z'].Key" \
        --output text | while read -r key; do
        
        if [[ -n "$key" && "$key" != "None" ]]; then
            log "Deleting old S3 backup: $key"
            aws s3 rm "s3://$S3_BUCKET/$key"
        fi
    done
}

# Verify backup integrity
verify_backup() {
    local backup_file="$1"
    
    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: $backup_file"
        return 1
    fi
    
    log "Verifying backup integrity: $(basename "$backup_file")"
    
    # Check if file is a valid gzip archive
    if ! gzip -t "$backup_file" 2>/dev/null; then
        log_error "Backup file is corrupted or not a valid gzip archive"
        return 1
    fi
    
    # Verify checksum if metadata exists
    local metadata_file="${backup_file}.meta"
    if [[ -f "$metadata_file" ]]; then
        local stored_checksum=$(grep '"checksum"' "$metadata_file" | cut -d'"' -f4)
        local actual_checksum=$(sha256sum "$backup_file" | cut -d' ' -f1)
        
        if [[ "$stored_checksum" == "$actual_checksum" ]]; then
            log "Backup checksum verified successfully"
        else
            log_error "Backup checksum verification failed"
            return 1
        fi
    fi
    
    log "Backup verification completed successfully"
    return 0
}

# Restore from backup
restore_backup() {
    local backup_file="$1"
    local target_db="${2:-$MONGO_DB}"
    
    if [[ ! -f "$backup_file" ]]; then
        log_error "Backup file not found: $backup_file"
        return 1
    fi
    
    log "Starting restore from: $(basename "$backup_file")"
    log "Target database: $target_db"
    
    # Verify backup before restore
    if ! verify_backup "$backup_file"; then
        log_error "Backup verification failed, aborting restore"
        return 1
    fi
    
    # Perform restore
    if mongorestore \
        --host "${MONGO_HOST}:${MONGO_PORT}" \
        --username "$MONGO_USER" \
        --password "$MONGO_PASS" \
        --authenticationDatabase admin \
        --db "$target_db" \
        --drop \
        --archive="$backup_file" \
        --gzip; then
        
        log "Restore completed successfully"
        return 0
    else
        log_error "Restore failed"
        return 1
    fi
}

# List available backups
list_backups() {
    log "Available local backups:"
    
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log "No backup directory found"
        return 0
    fi
    
    local backups=($(find "$BACKUP_DIR" -name "*.archive.gz" -type f | sort -r))
    
    if [[ ${#backups[@]} -eq 0 ]]; then
        log "No backups found"
        return 0
    fi
    
    printf "%-40s %-15s %-20s %-10s\n" "Backup File" "Size" "Date" "Verified"
    printf "%-40s %-15s %-20s %-10s\n" "----------" "----" "----" "--------"
    
    for backup in "${backups[@]}"; do
        local filename=$(basename "$backup")
        local size=$(du -h "$backup" | cut -f1)
        local date=$(stat -c %y "$backup" | cut -d' ' -f1,2 | cut -d'.' -f1)
        local verified="Unknown"
        
        if verify_backup "$backup" >/dev/null 2>&1; then
            verified="✓"
        else
            verified="✗"
        fi
        
        printf "%-40s %-15s %-20s %-10s\n" "$filename" "$size" "$date" "$verified"
    done
}

# Health check
health_check() {
    # Check if MongoDB is accessible
    if ! mongosh --host "${MONGO_HOST}:${MONGO_PORT}" --username "$MONGO_USER" --password "$MONGO_PASS" --authenticationDatabase admin --eval "db.runCommand('ping')" --quiet >/dev/null 2>&1; then
        log_error "Cannot connect to MongoDB"
        return 1
    fi
    
    # Check backup directory
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log_error "Backup directory not found: $BACKUP_DIR"
        return 1
    fi
    
    # Check disk space (warn if less than 1GB free)
    local free_space=$(df "$BACKUP_DIR" | awk 'NR==2 {print $4}')
    if [[ $free_space -lt 1048576 ]]; then  # 1GB in KB
        log "Warning: Low disk space in backup directory"
    fi
    
    log "Health check passed"
    return 0
}

# Main execution
case "${1:-backup}" in
    backup)
        create_backup
        ;;
    restore)
        if [[ -n "$2" ]]; then
            restore_backup "$2" "$3"
        else
            log_error "Usage: $0 restore <backup_file> [target_db]"
            exit 1
        fi
        ;;
    list)
        list_backups
        ;;
    verify)
        if [[ -n "$2" ]]; then
            verify_backup "$2"
        else
            log_error "Usage: $0 verify <backup_file>"
            exit 1
        fi
        ;;
    cleanup)
        cleanup_old_backups
        ;;
    health)
        health_check
        ;;
    *)
        echo "Usage: $0 {backup|restore|list|verify|cleanup|health}"
        exit 1
        ;;
esac