const { v4: uuidv4 } = require('uuid');

class BanService {
    constructor() {
        this.bans = new Map(); // deviceId -> ban info
        this.spamTracker = new Map(); // deviceId -> spam data
        this.banHistory = [];
        this.maxBanHistory = 1000;
        
        // Spam detection settings
        this.spamSettings = {
            messagesPerMinute: parseInt(process.env.SPAM_MESSAGES_PER_MINUTE) || 10,
            warningThreshold: parseInt(process.env.SPAM_WARNING_THRESHOLD) || 8,
            banDurationMinutes: parseInt(process.env.SPAM_BAN_DURATION) || 60,
            trackingWindowMs: 60 * 1000 // 1 minute
        };
    }

    // Ban management
    banUser(deviceId, reason = 'Violation of server rules', durationMinutes = 30, bannedBy = 'system') {
        const banId = uuidv4();
        const now = new Date();
        const expiry = new Date(now.getTime() + (durationMinutes * 60 * 1000));

        const ban = {
            id: banId,
            deviceId,
            reason,
            bannedAt: now,
            bannedBy,
            expiresAt: expiry,
            durationMinutes,
            active: true
        };

        this.bans.set(deviceId, ban);

        // Add to history
        this.banHistory.push({ ...ban });
        if (this.banHistory.length > this.maxBanHistory) {
            this.banHistory = this.banHistory.slice(-this.maxBanHistory);
        }

        return ban;
    }

    unbanUser(deviceId, unbannedBy = 'system') {
        const ban = this.bans.get(deviceId);
        if (ban) {
            ban.active = false;
            ban.unbannedAt = new Date();
            ban.unbannedBy = unbannedBy;
            
            this.bans.delete(deviceId);
            
            return { success: true, ban };
        }
        return { success: false, reason: 'User not banned' };
    }

    isUserBanned(deviceId) {
        const ban = this.bans.get(deviceId);
        
        if (!ban) {
            return { banned: false };
        }

        // Check if ban has expired
        if (new Date() > ban.expiresAt) {
            this.unbanUser(deviceId, 'system');
            return { banned: false };
        }

        return {
            banned: true,
            ban,
            expiry: ban.expiresAt,
            reason: ban.reason,
            remainingTime: ban.expiresAt - new Date()
        };
    }

    // Spam detection and prevention
    checkSpam(deviceId, messageContent = '') {
        const now = Date.now();
        const windowStart = now - this.spamSettings.trackingWindowMs;

        // Get or create spam tracking data
        let spamData = this.spamTracker.get(deviceId);
        if (!spamData) {
            spamData = {
                messages: [],
                warnings: 0,
                lastWarning: null
            };
            this.spamTracker.set(deviceId, spamData);
        }

        // Clean old messages
        spamData.messages = spamData.messages.filter(msg => msg.timestamp > windowStart);

        // Add current message
        spamData.messages.push({
            timestamp: now,
            content: messageContent.substring(0, 100) // Store first 100 chars for analysis
        });

        const messageCount = spamData.messages.length;
        const isSpam = messageCount > this.spamSettings.messagesPerMinute;
        const isWarning = messageCount > this.spamSettings.warningThreshold;

        let shouldBan = false;
        let shouldWarn = false;

        if (isSpam) {
            // Check for repeated content (additional spam detection)
            const recentMessages = spamData.messages.slice(-5);
            const uniqueMessages = new Set(recentMessages.map(m => m.content.toLowerCase().trim()));
            const isRepeating = uniqueMessages.size <= 2 && recentMessages.length >= 4;

            if (isRepeating || messageCount >= this.spamSettings.messagesPerMinute + 5) {
                shouldBan = true;
            }
        } else if (isWarning && (!spamData.lastWarning || now - spamData.lastWarning > 30000)) {
            // Issue warning if threshold exceeded and no warning in last 30 seconds
            shouldWarn = true;
            spamData.warnings++;
            spamData.lastWarning = now;
        }

        return {
            isSpam,
            shouldBan,
            shouldWarn,
            messageCount,
            limit: this.spamSettings.messagesPerMinute,
            remainingMessages: Math.max(0, this.spamSettings.messagesPerMinute - messageCount),
            warnings: spamData.warnings,
            windowReset: windowStart + this.spamSettings.trackingWindowMs
        };
    }

    // Failed login attempt tracking
    trackFailedLogin(deviceId, username) {
        const key = `login_${deviceId}`;
        let attempts = this.spamTracker.get(key);
        
        if (!attempts) {
            attempts = {
                count: 0,
                firstAttempt: Date.now(),
                lastAttempt: Date.now(),
                usernames: []
            };
        }

        attempts.count++;
        attempts.lastAttempt = Date.now();
        attempts.usernames.push(username);

        this.spamTracker.set(key, attempts);

        // Auto-ban after 10 failed attempts in 10 minutes
        const tenMinutes = 10 * 60 * 1000;
        if (attempts.count >= 10 && (Date.now() - attempts.firstAttempt) < tenMinutes) {
            this.banUser(deviceId, 'Too many failed login attempts', 60, 'system');
            return { banned: true, reason: 'Too many failed login attempts' };
        }

        return { 
            banned: false, 
            attempts: attempts.count,
            remaining: 10 - attempts.count
        };
    }

    clearFailedLogins(deviceId) {
        const key = `login_${deviceId}`;
        this.spamTracker.delete(key);
    }

    // Ban statistics and management
    getBanStats() {
        const activeBans = Array.from(this.bans.values());
        const now = new Date();

        return {
            activeBans: activeBans.length,
            totalBans: this.banHistory.length,
            bansByReason: this.banHistory.reduce((acc, ban) => {
                acc[ban.reason] = (acc[ban.reason] || 0) + 1;
                return acc;
            }, {}),
            recentBans: this.banHistory
                .filter(ban => (now - ban.bannedAt) < (24 * 60 * 60 * 1000)) // last 24 hours
                .length,
            averageBanDuration: this.getAverageBanDuration()
        };
    }

    getAverageBanDuration() {
        if (this.banHistory.length === 0) return 0;
        
        const totalDuration = this.banHistory.reduce((sum, ban) => sum + ban.durationMinutes, 0);
        return Math.round(totalDuration / this.banHistory.length);
    }

    getBannedUsers(includeExpired = false) {
        const bans = includeExpired ? this.banHistory : Array.from(this.bans.values());
        
        return bans.map(ban => ({
            id: ban.id,
            deviceId: ban.deviceId,
            reason: ban.reason,
            bannedAt: ban.bannedAt,
            expiresAt: ban.expiresAt,
            bannedBy: ban.bannedBy,
            active: ban.active !== false,
            remainingTime: ban.expiresAt ? Math.max(0, ban.expiresAt - new Date()) : 0
        }));
    }

    // IP-based banning (if IP tracking is implemented)
    banIP(ipAddress, reason = 'IP banned', durationMinutes = 60) {
        const banId = uuidv4();
        const key = `ip_${ipAddress}`;
        const now = new Date();
        const expiry = new Date(now.getTime() + (durationMinutes * 60 * 1000));

        const ban = {
            id: banId,
            type: 'ip',
            ipAddress,
            reason,
            bannedAt: now,
            expiresAt: expiry,
            durationMinutes,
            active: true
        };

        this.bans.set(key, ban);
        return ban;
    }

    isIPBanned(ipAddress) {
        const key = `ip_${ipAddress}`;
        const ban = this.bans.get(key);
        
        if (!ban) return { banned: false };
        
        if (new Date() > ban.expiresAt) {
            this.bans.delete(key);
            return { banned: false };
        }

        return {
            banned: true,
            ban,
            expiry: ban.expiresAt,
            reason: ban.reason
        };
    }

    // Cleanup methods
    cleanExpiredBans() {
        const now = new Date();
        let cleaned = 0;

        for (const [key, ban] of this.bans.entries()) {
            if (now > ban.expiresAt) {
                this.bans.delete(key);
                cleaned++;
            }
        }

        return cleaned;
    }

    cleanOldSpamData(maxAgeHours = 24) {
        const cutoff = Date.now() - (maxAgeHours * 60 * 60 * 1000);
        let cleaned = 0;

        for (const [key, data] of this.spamTracker.entries()) {
            if (data.messages) {
                data.messages = data.messages.filter(msg => msg.timestamp > cutoff);
                if (data.messages.length === 0) {
                    this.spamTracker.delete(key);
                    cleaned++;
                }
            }
        }

        return cleaned;
    }

    // Admin tools
    massUnban(reason = 'Mass unban by admin') {
        const unbannedCount = this.bans.size;
        this.bans.clear();
        return { unbannedCount, reason };
    }

    searchBans(query) {
        const searchTerm = query.toLowerCase();
        return this.banHistory.filter(ban => 
            ban.reason.toLowerCase().includes(searchTerm) ||
            ban.deviceId.toLowerCase().includes(searchTerm) ||
            ban.bannedBy.toLowerCase().includes(searchTerm)
        );
    }

    // Export ban data
    exportBans() {
        return {
            activeBans: Array.from(this.bans.values()),
            banHistory: this.banHistory,
            stats: this.getBanStats(),
            exportedAt: new Date().toISOString()
        };
    }
}

module.exports = BanService;