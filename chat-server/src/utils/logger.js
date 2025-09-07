const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logDir = path.join(__dirname, '../../logs');
        this.ensureLogDir();
    }

    ensureLogDir() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    formatMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const metaString = Object.keys(meta).length > 0 ? JSON.stringify(meta) : '';
        return `[${timestamp}] ${level.toUpperCase()}: ${message} ${metaString}`.trim();
    }

    writeToFile(level, formattedMessage) {
        const date = new Date().toISOString().split('T')[0];
        const filename = path.join(this.logDir, `${date}.log`);
        
        try {
            fs.appendFileSync(filename, formattedMessage + '\n');
            
            // Also write errors to separate error log
            if (level === 'error') {
                const errorFilename = path.join(this.logDir, `${date}-error.log`);
                fs.appendFileSync(errorFilename, formattedMessage + '\n');
            }
        } catch (error) {
            // If we can't write to file, at least log to console
            console.error('Failed to write to log file:', error.message);
        }
    }

    log(level, message, meta = {}) {
        const formattedMessage = this.formatMessage(level, message, meta);
        
        // Console output with colors
        if (process.env.NODE_ENV !== 'test') {
            const colors = {
                error: '\x1b[31m',
                warn: '\x1b[33m',
                info: '\x1b[36m',
                debug: '\x1b[37m',
                reset: '\x1b[0m'
            };
            
            const color = colors[level] || colors.info;
            console.log(`${color}${formattedMessage}${colors.reset}`);
        }
        
        // File output
        if (process.env.NODE_ENV !== 'test') {
            this.writeToFile(level, formattedMessage);
        }
    }

    error(message, meta = {}) {
        this.log('error', message, meta);
    }

    warn(message, meta = {}) {
        this.log('warn', message, meta);
    }

    info(message, meta = {}) {
        this.log('info', message, meta);
    }

    debug(message, meta = {}) {
        if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
            this.log('debug', message, meta);
        }
    }

    // Chat-specific logging methods
    logConnection(username, deviceId, ip) {
        this.info('User connected', {
            username,
            deviceId: deviceId.substring(0, 8) + '...',
            ip
        });
    }

    logDisconnection(username, reason) {
        this.info('User disconnected', {
            username,
            reason
        });
    }

    logMessage(username, messageLength, type = 'text') {
        this.debug('Message sent', {
            username,
            messageLength,
            type
        });
    }

    logBan(deviceId, reason, duration, bannedBy = 'system') {
        this.warn('User banned', {
            deviceId: deviceId.substring(0, 8) + '...',
            reason,
            duration,
            bannedBy
        });
    }

    logSpam(deviceId, messageCount, action) {
        this.warn('Spam detected', {
            deviceId: deviceId.substring(0, 8) + '...',
            messageCount,
            action
        });
    }

    logAdminAction(action, target, adminKey, ip) {
        this.info('Admin action', {
            action,
            target,
            adminKey: adminKey ? adminKey.substring(0, 8) + '...' : 'unknown',
            ip
        });
    }

    // Performance logging
    logPerformance(operation, duration, metadata = {}) {
        if (duration > 1000) { // Log slow operations (>1s)
            this.warn('Slow operation detected', {
                operation,
                duration: `${duration}ms`,
                ...metadata
            });
        } else {
            this.debug('Operation completed', {
                operation,
                duration: `${duration}ms`,
                ...metadata
            });
        }
    }

    // Security logging
    logSecurityEvent(event, severity = 'medium', metadata = {}) {
        const logMethod = severity === 'high' ? 'error' : 
                         severity === 'medium' ? 'warn' : 'info';
        
        this[logMethod](`Security event: ${event}`, {
            severity,
            timestamp: new Date().toISOString(),
            ...metadata
        });
    }

    // Clean old log files (older than specified days)
    cleanOldLogs(days = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        if (!fs.existsSync(this.logDir)) return;
        
        try {
            const files = fs.readdirSync(this.logDir);
            let cleaned = 0;
            
            files.forEach(file => {
                const filePath = path.join(this.logDir, file);
                const stats = fs.statSync(filePath);
                
                if (stats.isFile() && stats.mtime < cutoffDate) {
                    fs.unlinkSync(filePath);
                    cleaned++;
                }
            });
            
            if (cleaned > 0) {
                this.info(`Cleaned ${cleaned} old log files`);
            }
        } catch (error) {
            this.error('Failed to clean old logs:', error);
        }
    }

    // Get log statistics
    getLogStats() {
        if (!fs.existsSync(this.logDir)) {
            return { error: 'Log directory not found' };
        }

        try {
            const files = fs.readdirSync(this.logDir);
            let totalSize = 0;
            let fileCount = 0;
            let oldestFile = null;
            let newestFile = null;

            files.forEach(file => {
                const filePath = path.join(this.logDir, file);
                const stats = fs.statSync(filePath);
                
                if (stats.isFile()) {
                    totalSize += stats.size;
                    fileCount++;
                    
                    if (!oldestFile || stats.mtime < oldestFile.mtime) {
                        oldestFile = { name: file, mtime: stats.mtime };
                    }
                    
                    if (!newestFile || stats.mtime > newestFile.mtime) {
                        newestFile = { name: file, mtime: stats.mtime };
                    }
                }
            });

            return {
                fileCount,
                totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
                oldestFile: oldestFile ? {
                    name: oldestFile.name,
                    date: oldestFile.mtime.toISOString().split('T')[0]
                } : null,
                newestFile: newestFile ? {
                    name: newestFile.name,
                    date: newestFile.mtime.toISOString().split('T')[0]
                } : null
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    // Read recent log entries
    getRecentLogs(lines = 100) {
        const today = new Date().toISOString().split('T')[0];
        const logFile = path.join(this.logDir, `${today}.log`);
        
        if (!fs.existsSync(logFile)) {
            return [];
        }

        try {
            const content = fs.readFileSync(logFile, 'utf8');
            const allLines = content.split('\n').filter(line => line.trim());
            return allLines.slice(-lines);
        } catch (error) {
            this.error('Failed to read log file:', error);
            return [];
        }
    }
}

module.exports = new Logger();