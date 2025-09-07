#!/bin/bash

# Health check script for backup service

set -e

# Check if backup script exists and is executable
if [[ ! -x /scripts/backup.sh ]]; then
    echo "Backup script not found or not executable"
    exit 1
fi

# Run health check
if /scripts/backup.sh health >/dev/null 2>&1; then
    echo "Backup service is healthy"
    exit 0
else
    echo "Backup service health check failed"
    exit 1
fi