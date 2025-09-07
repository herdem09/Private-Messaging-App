const express = require('express');
const UserService = require('../services/UserService');
const ChatService = require('../services/ChatService');
const BanService = require('../services/BanService');
const MainServerService = require('../services/MainServerService');

const router = express.Router();

// Initialize services for health checks
const userService = new UserService();
const chatService = new ChatService();
const banService = new BanService();
const mainServerService = new MainServerService();

// Basic health check
router.get('/', (req, res) => {
    try {
        const health = {
            status: 'OK',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            environment: process.env.NODE_ENV || 'development',
            serverName: process.env.SERVER_NAME || 'Chat Server',
            version: '1.0.0'
        };

        // Basic service checks
        health.services = {
            chat: 'OK',
            users: 'OK',
            bans: 'OK',
            mainServer: mainServerService.isRegistered ? 'OK' : 'WARNING'
        };

        // Current statistics
        health.stats = {
            onlineUsers: userService.getOnlineUserCount(),
            maxUsers: parseInt(process.env.MAX_USERS) || 100,
            totalMessages: chatService.getTotalMessageCount(),
            activeBans: banService.getBanStats().activeBans
        };

        const statusCode = health.status === 'OK' ? 200 : 503;
        res.status(statusCode).json(health);
    } catch (error) {
        res.status(503).json({
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Detailed health check
router.get('/detailed', async (req, res) => {
    try {
        const detailed = {
            status: 'OK',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            
            // System information
            system: {
                platform: process.platform,
                nodeVersion: process.version,
                memory: {
                    ...process.memoryUsage(),
                    freeMemory: require('os').freemem(),
                    totalMemory: require('os').totalmem()
                },
                cpu: {
                    usage: process.cpuUsage(),
                    loadAverage: require('os').loadavg()
                }
            },

            // Server configuration
            config: {
                serverName: process.env.SERVER_NAME || 'Chat Server',
                maxUsers: parseInt(process.env.MAX_USERS) || 100,
                hasPassword: !!process.env.SERVER_PASSWORD,
                port: process.env.PORT || 8080,
                environment: process.env.NODE_ENV || 'development'
            }
        };

        // User service statistics
        try {
            const userStats = userService.getUserStats();
            detailed.users = {
                online: userStats.total,
                guests: userStats.guests,
                registered: userStats.registered,
                byRole: userStats.byRole,
                averageSessionTime: userStats.averageSessionTime,
                totalConnections: userStats.totalConnections,
                uniqueVisitors: userService.getUniqueVisitors(7)
            };
        } catch (error) {
            detailed.users = { error: 'Unable to fetch user statistics' };
            detailed.status = 'WARNING';
        }

        // Chat service statistics
        try {
            const messageStats = chatService.getMessageStats();
            detailed.messages = {
                total: messageStats.total,
                lastHour: messageStats.lastHour,
                last24Hours: messageStats.last24Hours,
                byType: messageStats.byType,
                topUsers: messageStats.topUsers.slice(0, 5) // Top 5 users
            };
        } catch (error) {
            detailed.messages = { error: 'Unable to fetch message statistics' };
            detailed.status = 'WARNING';
        }

        // Ban service statistics
        try {
            const banStats = banService.getBanStats();
            detailed.security = {
                activeBans: banStats.activeBans,
                totalBans: banStats.totalBans,
                recentBans: banStats.recentBans,
                bansByReason: banStats.bansByReason,
                averageBanDuration: banStats.averageBanDuration
            };
        } catch (error) {
            detailed.security = { error: 'Unable to fetch security statistics' };
            detailed.status = 'WARNING';
        }

        // Main server connection status
        try {
            const connectionStats = mainServerService.getConnectionStats();
            const mainServerHealth = await mainServerService.checkMainServerHealth();
            
            detailed.mainServer = {
                connected: connectionStats.isRegistered,
                serverId: connectionStats.serverId,
                lastPing: connectionStats.lastPingTime,
                mainServerHealthy: mainServerHealth.isHealthy,
                registrationAttempts: connectionStats.registrationAttempts,
                uptime: connectionStats.uptime
            };
        } catch (error) {
            detailed.mainServer = { 
                error: 'Unable to fetch main server status',
                connected: false 
            };
            detailed.status = 'WARNING';
        }

        // Performance metrics
        detailed.performance = {
            eventLoopDelay: process.hrtime(),
            activeHandles: process._getActiveHandles().length,
            activeRequests: process._getActiveRequests().length
        };

        const statusCode = detailed.status === 'OK' ? 200 : 503;
        res.status(statusCode).json(detailed);
    } catch (error) {
        res.status(503).json({
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Service-specific health checks
router.get('/users', (req, res) => {
    try {
        const userStats = userService.getUserStats();
        res.json({
            status: 'OK',
            service: 'users',
            timestamp: new Date().toISOString(),
            stats: userStats,
            onlineUsers: userService.getOnlineUsers().map(user => ({
                id: user.id,
                username: user.username,
                isGuest: user.isGuest,
                joinedAt: user.joinedAt
            }))
        });
    } catch (error) {
        res.status(503).json({
            status: 'ERROR',
            service: 'users',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

router.get('/messages', (req, res) => {
    try {
        const messageStats = chatService.getMessageStats();
        res.json({
            status: 'OK',
            service: 'messages',
            timestamp: new Date().toISOString(),
            stats: messageStats,
            recentMessages: chatService.getRecentMessages(10).map(msg => ({
                id: msg.id,
                senderName: msg.senderName,
                type: msg.type,
                timestamp: msg.timestamp,
                contentLength: msg.content.length
            }))
        });
    } catch (error) {
        res.status(503).json({
            status: 'ERROR',
            service: 'messages',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

router.get('/security', (req, res) => {
    try {
        const banStats = banService.getBanStats();
        res.json({
            status: 'OK',
            service: 'security',
            timestamp: new Date().toISOString(),
            stats: banStats,
            activeBans: banService.getBannedUsers().map(ban => ({
                id: ban.id,
                reason: ban.reason,
                bannedAt: ban.bannedAt,
                expiresAt: ban.expiresAt,
                remainingTime: ban.remainingTime
            }))
        });
    } catch (error) {
        res.status(503).json({
            status: 'ERROR',
            service: 'security',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

router.get('/main-server', async (req, res) => {
    try {
        const connectionStats = mainServerService.getConnectionStats();
        const healthCheck = await mainServerService.checkMainServerHealth();
        
        res.json({
            status: connectionStats.isRegistered && healthCheck.isHealthy ? 'OK' : 'WARNING',
            service: 'main-server',
            timestamp: new Date().toISOString(),
            connection: connectionStats,
            mainServerHealth: healthCheck
        });
    } catch (error) {
        res.status(503).json({
            status: 'ERROR',
            service: 'main-server',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Readiness probe (for Kubernetes)
router.get('/ready', (req, res) => {
    try {
        const isReady = userService.getOnlineUserCount() >= 0; // Basic readiness check
        
        if (isReady) {
            res.status(200).json({
                status: 'READY',
                timestamp: new Date().toISOString()
            });
        } else {
            res.status(503).json({
                status: 'NOT_READY',
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        res.status(503).json({
            status: 'NOT_READY',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

// Liveness probe (for Kubernetes)
router.get('/live', (req, res) => {
    res.status(200).json({
        status: 'ALIVE',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

module.exports = router;