FROM alpine:latest

# Install required packages
RUN apk add --no-cache \
    bash \
    curl \
    mongodb-tools \
    aws-cli \
    coreutils \
    findutils \
    gzip \
    tar \
    cronie

# Create backup user
RUN addgroup -g 1001 backup && \
    adduser -D -u 1001 -G backup backup

# Create directories
RUN mkdir -p /backups /scripts /var/log/backup && \
    chown -R backup:backup /backups /scripts /var/log/backup

# Copy backup scripts
COPY scripts/ /scripts/
COPY crontab /etc/crontabs/backup

# Make scripts executable
RUN chmod +x /scripts/*.sh

# Switch to backup user
USER backup

# Set working directory
WORKDIR /backups

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD /scripts/healthcheck.sh

# Start cron daemon
CMD ["crond", "-f", "-l", "2"]