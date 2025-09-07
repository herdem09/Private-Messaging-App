const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

class UserService {
    constructor() {
        this.users = new Map(); // socketId -> user
        this.usersByDeviceId = new Map(); // deviceId -> user
        this.connectionHistory = [];
        this.maxConnectionHistory = 1000;
    }

    async authenticateUser(token, username, deviceId) {
        try {
            // If no token provided, create a guest user
            if (!token) {
                return this.createGuestUser(username, deviceId);
            }

            // Verify JWT token (if using token-based auth)
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
                return this.createUserFromToken(decoded, username, deviceId);
            } catch (jwtError) {
                // If JWT fails, fall back to guest user
                return this.createGuestUser(username, deviceId);
            }
        } catch (error) {
            throw new Error('Authentication failed');
        }
    }

    createGuestUser(username, deviceId) {
        // Validate username
        if (!this.isValidUsername(username)) {
            throw new Error('Invalid username');
        }

        // Check if device is already connected
        const existingUser = this.usersByDeviceId.get(deviceId);
        if (existingUser) {
            throw new Error('Device already connected');
        }

        const user = {
            id: uuidv4(),
            username: this.sanitizeUsername(username),
            deviceId,
            isGuest: true,
            joinedAt: new Date(),
            lastActivity: new Date(),
            permissions: ['chat', 'read'],
            metadata: {
                userAgent: '',
                ip: '',
                country: ''
            }
        };

        return user;
    }

    createUserFromToken(tokenData, username, deviceId) {
        const user = {
            id: tokenData.userId || uuidv4(),
            username: username || tokenData.username,
            deviceId,
            isGuest: false,
            isRegistered: true,
            joinedAt: new Date(),
            lastActivity: new Date(),
            permissions: tokenData.permissions || ['chat', 'read'],
            role: tokenData.role || 'user',
            metadata: {
                email: tokenData.email,
                registeredAt: tokenData.registeredAt,
                userAgent: '',
                ip: '',
                country: ''
            }
        };

        return user;
    }

    addUser(socketId, user) {
        // Add to maps
        this.users.set(socketId, user);
        this.usersByDeviceId.set(user.deviceId, { ...user, socketId });

        // Add to connection history
        this.connectionHistory.push({
            userId: user.id,
            username: user.username,
            deviceId: user.deviceId,
            connectedAt: new Date(),
            socketId
        });

        // Keep history size manageable
        if (this.connectionHistory.length > this.maxConnectionHistory) {
            this.connectionHistory = this.connectionHistory.slice(-this.maxConnectionHistory);
        }

        return user;
    }

    removeUser(socketId) {
        const user = this.users.get(socketId);
        if (user) {
            this.users.delete(socketId);
            this.usersByDeviceId.delete(user.deviceId);

            // Update connection history
            const historyEntry = this.connectionHistory.find(
                entry => entry.socketId === socketId
            );
            if (historyEntry) {
                historyEntry.disconnectedAt = new Date();
                historyEntry.duration = historyEntry.disconnectedAt - historyEntry.connectedAt;
            }

            return user;
        }
        return null;
    }

    getUser(socketId) {
        return this.users.get(socketId);
    }

    getUserByDeviceId(deviceId) {
        return this.usersByDeviceId.get(deviceId);
    }

    getOnlineUsers() {
        return Array.from(this.users.values()).map(user => ({
            id: user.id,
            username: user.username,
            isGuest: user.isGuest,
            joinedAt: user.joinedAt,
            role: user.role || 'user',
            isOnline: true
        }));
    }

    getOnlineUserCount() {
        return this.users.size;
    }

    getUserStats() {
        const users = Array.from(this.users.values());
        const now = new Date();

        return {
            total: users.length,
            guests: users.filter(u => u.isGuest).length,
            registered: users.filter(u => !u.isGuest).length,
            byRole: users.reduce((acc, user) => {
                const role = user.role || 'user';
                acc[role] = (acc[role] || 0) + 1;
                return acc;
            }, {}),
            averageSessionTime: this.getAverageSessionTime(),
            totalConnections: this.connectionHistory.length,
            activeConnections: users.length
        };
    }

    getAverageSessionTime() {
        const completedSessions = this.connectionHistory.filter(
            entry => entry.disconnectedAt && entry.duration
        );

        if (completedSessions.length === 0) return 0;

        const totalDuration = completedSessions.reduce(
            (sum, session) => sum + session.duration, 0
        );

        return Math.round(totalDuration / completedSessions.length / 1000); // in seconds
    }

    updateUserActivity(socketId) {
        const user = this.users.get(socketId);
        if (user) {
            user.lastActivity = new Date();
        }
    }

    isValidUsername(username) {
        if (!username || typeof username !== 'string') return false;
        
        // Check length
        if (username.length < 3 || username.length > 20) return false;
        
        // Check characters (alphanumeric, underscore, dash)
        const validPattern = /^[a-zA-Z0-9_-]+$/;
        if (!validPattern.test(username)) return false;
        
        // Check if username is already taken
        const existingUsers = Array.from(this.users.values());
        if (existingUsers.some(u => u.username.toLowerCase() === username.toLowerCase())) {
            return false;
        }
        
        return true;
    }

    sanitizeUsername(username) {
        return username.trim().replace(/[^\w\-]/g, '').substring(0, 20);
    }

    // User permissions and roles
    hasPermission(socketId, permission) {
        const user = this.users.get(socketId);
        return user && user.permissions && user.permissions.includes(permission);
    }

    isAdmin(socketId) {
        const user = this.users.get(socketId);
        return user && (user.role === 'admin' || user.role === 'owner');
    }

    isModerator(socketId) {
        const user = this.users.get(socketId);
        return user && ['admin', 'owner', 'moderator'].includes(user.role);
    }

    // User management actions
    kickUser(socketId, reason = 'Kicked by admin') {
        const user = this.users.get(socketId);
        if (user) {
            this.removeUser(socketId);
            return {
                success: true,
                user: {
                    id: user.id,
                    username: user.username
                },
                reason
            };
        }
        return { success: false, reason: 'User not found' };
    }

    muteUser(socketId, durationMinutes = 10) {
        const user = this.users.get(socketId);
        if (user) {
            const muteExpiry = new Date(Date.now() + (durationMinutes * 60 * 1000));
            user.mutedUntil = muteExpiry;
            user.permissions = user.permissions.filter(p => p !== 'chat');
            
            return {
                success: true,
                user: {
                    id: user.id,
                    username: user.username
                },
                muteExpiry
            };
        }
        return { success: false, reason: 'User not found' };
    }

    unmuteUser(socketId) {
        const user = this.users.get(socketId);
        if (user) {
            delete user.mutedUntil;
            if (!user.permissions.includes('chat')) {
                user.permissions.push('chat');
            }
            
            return {
                success: true,
                user: {
                    id: user.id,
                    username: user.username
                }
            };
        }
        return { success: false, reason: 'User not found' };
    }

    isUserMuted(socketId) {
        const user = this.users.get(socketId);
        if (!user || !user.mutedUntil) return false;
        
        if (new Date() > user.mutedUntil) {
            // Mute expired, remove it
            this.unmuteUser(socketId);
            return false;
        }
        
        return true;
    }

    // Connection history and analytics
    getConnectionHistory(limit = 100) {
        return this.connectionHistory
            .slice(-limit)
            .map(entry => ({
                ...entry,
                duration: entry.duration ? Math.round(entry.duration / 1000) : null
            }));
    }

    getUniqueVisitors(days = 7) {
        const cutoffDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));
        const recentConnections = this.connectionHistory.filter(
            entry => entry.connectedAt > cutoffDate
        );
        
        const uniqueDevices = new Set(recentConnections.map(entry => entry.deviceId));
        return uniqueDevices.size;
    }

    getPeakUsers() {
        // This would need to be tracked over time in a real implementation
        return {
            current: this.users.size,
            today: Math.max(this.users.size, 0), // Placeholder
            allTime: Math.max(this.users.size, 0) // Placeholder
        };
    }

    // Cleanup methods
    cleanupInactiveUsers(inactiveThresholdMinutes = 30) {
        const threshold = new Date(Date.now() - (inactiveThresholdMinutes * 60 * 1000));
        const inactiveUsers = [];

        for (const [socketId, user] of this.users.entries()) {
            if (user.lastActivity < threshold) {
                inactiveUsers.push(socketId);
            }
        }

        inactiveUsers.forEach(socketId => {
            this.removeUser(socketId);
        });

        return inactiveUsers.length;
    }
}

module.exports = UserService;