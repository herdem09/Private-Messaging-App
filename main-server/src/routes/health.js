const express = require('express');
const mongoose = require('mongoose');
const Server = require('../models/Server');

const router = express.Router();

// Health check endpoint
router.get('/', async (req, res) => {
    try {
        const health = {
            status: 'OK',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            environment: process.env.NODE_ENV || 'development'
        };

        // Check database connection
        if (mongoose.connection.readyState === 1) {
            health.database = 'connected';
        } else {
            health.database = 'disconnected';
            health.status = 'WARNING';
        }

        // Get basic stats
        try {
            const serverCount = await Server.countDocuments();
            const onlineCount = await Server.countDocuments({ isOnline: true });
            
            health.stats = {
                totalServers: serverCount,
                onlineServers: onlineCount
            };
        } catch (error) {
            health.stats = 'unavailable';
        }

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
                memory: process.memoryUsage(),
                cpu: process.cpuUsage()
            },

            // Database status
            database: {
                status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
                host: mongoose.connection.host,
                name: mongoose.connection.name,
                collections: mongoose.connection.collections ? Object.keys(mongoose.connection.collections).length : 0
            }
        };

        // Server statistics
        try {
            const [totalServers, onlineServers, recentServers] = await Promise.all([
                Server.countDocuments(),
                Server.countDocuments({ isOnline: true }),
                Server.countDocuments({ 
                    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
                })
            ]);

            detailed.serverStats = {
                total: totalServers,
                online: onlineServers,
                offline: totalServers - onlineServers,
                registeredLast24h: recentServers
            };

            // Get user statistics
            const userStats = await Server.aggregate([
                { $match: { isOnline: true } },
                {
                    $group: {
                        _id: null,
                        totalUsers: { $sum: '$currentUsers' },
                        totalCapacity: { $sum: '$maxUsers' },
                        avgUsers: { $avg: '$currentUsers' }
                    }
                }
            ]);

            if (userStats.length > 0) {
                detailed.userStats = {
                    totalActiveUsers: userStats[0].totalUsers,
                    totalCapacity: userStats[0].totalCapacity,
                    averageUsersPerServer: Math.round(userStats[0].avgUsers),
                    capacityUsage: Math.round((userStats[0].totalUsers / userStats[0].totalCapacity) * 100)
                };
            }

        } catch (statsError) {
            detailed.serverStats = { error: 'Unable to fetch statistics' };
            detailed.status = 'WARNING';
        }

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

module.exports = router;