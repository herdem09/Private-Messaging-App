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
        
        fs.appendFileSync(filename, formattedMessage + '\n');
        
        // Also write errors to separate error log
        if (level === 'error') {
            const errorFilename = path.join(this.logDir, `${date}-error.log`);
            fs.appendFileSync(errorFilename, formattedMessage + '\n');
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

    // Clean old log files (older than 30 days)
    cleanOldLogs(days = 30) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        
        if (!fs.existsSync(this.logDir)) return;
        
        const files = fs.readdirSync(this.logDir);
        files.forEach(file => {
            const filePath = path.join(this.logDir, file);
            const stats = fs.statSync(filePath);
            
            if (stats.isFile() && stats.mtime < cutoffDate) {
                fs.unlinkSync(filePath);
                this.info(`Cleaned old log file: ${file}`);
            }
        });
    }
}

module.exports = new Logger();