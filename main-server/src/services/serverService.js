const axios = require('axios');
const Server = require('../models/Server');
const logger = require('../utils/logger');

class ServerService {
    
    // Ping a server to check if it's online
    async pingServer(server, timeout = 5000) {
        try {
            const url = `http://${server.ipAddress}:${server.port}/health`;
            const response = await axios.get(url, { 
                timeout,
                validateStatus: () => true // Don't throw on HTTP errors
            });
            
            if (response.status === 200) {
                logger.debug(`Server ${server.fullAddress} is online`);
                return true;
            } else {
                logger.debug(`Server ${server.fullAddress} returned status ${response.status}`);
                return false;
            }
        } catch (error) {
            logger.debug(`Server ${server.fullAddress} ping failed: ${error.message}`);
            return false;
        }
    }

    // Check all servers and update their online status
    async checkAllServers() {
        try {
            const servers = await Server.find({});
            const results = {
                total: servers.length,
                online: 0,
                offline: 0,
                errors: []
            };

            const promises = servers.map(async (server) => {
                try {
                    const isOnline = await this.pingServer(server);
                    
                    if (isOnline && !server.isOnline) {
                        // Server came online
                        server.isOnline = true;
                        server.lastPing = new Date();
                        await server.save();
                        logger.info(`Server ${server.name} (${server.fullAddress}) came online`);
                        results.online++;
                    } else if (!isOnline && server.isOnline) {
                        // Server went offline
                        server.isOnline = false;
                        server.currentUsers = 0;
                        await server.save();
                        logger.info(`Server ${server.name} (${server.fullAddress}) went offline`);
                        results.offline++;
                    } else if (isOnline) {
                        // Server is still online, update ping time
                        server.lastPing = new Date();
                        await server.save();
                        results.online++;
                    } else {
                        results.offline++;
                    }
                } catch (error) {
                    results.errors.push({
                        serverId: server._id,
                        serverName: server.name,
                        error: error.message
                    });
                    logger.error(`Error checking server ${server.name}: ${error.message}`);
                }
            });

            await Promise.all(promises);
            logger.info(`Server check completed: ${results.online} online, ${results.offline} offline, ${results.errors.length} errors`);
            return results;
        } catch (error) {
            logger.error('Error in checkAllServers:', error);
            throw error;
        }
    }

    // Clean up inactive servers (haven't pinged in a while)
    async cleanupInactiveServers(inactiveThresholdMinutes = 10) {
        try {
            const thresholdTime = new Date(Date.now() - (inactiveThresholdMinutes * 60 * 1000));
            
            const result = await Server.updateMany(
                {
                    isOnline: true,
                    lastPing: { $lt: thresholdTime }
                },
                {
                    $set: {
                        isOnline: false,
                        currentUsers: 0
                    }
                }
            );

            if (result.modifiedCount > 0) {
                logger.info(`Marked ${result.modifiedCount} inactive servers as offline`);
            }

            return result;
        } catch (error) {
            logger.error('Error in cleanupInactiveServers:', error);
            throw error;
        }
    }

    // Get server statistics
    async getServerStatistics() {
        try {
            const [
                totalServers,
                onlineServers,
                recentServers,
                userStats
            ] = await Promise.all([
                Server.countDocuments(),
                Server.countDocuments({ isOnline: true }),
                Server.countDocuments({ 
                    createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } 
                }),
                Server.aggregate([
                    { $match: { isOnline: true } },
                    {
                        $group: {
                            _id: null,
                            totalUsers: { $sum: '$currentUsers' },
                            totalCapacity: { $sum: '$maxUsers' },
                            totalConnections: { $sum: '$totalConnections' },
                            totalMessages: { $sum: '$totalMessages' }
                        }
                    }
                ])
            ]);

            const stats = {
                servers: {
                    total: totalServers,
                    online: onlineServers,
                    offline: totalServers - onlineServers,
                    registeredLast24h: recentServers
                },
                users: {
                    active: userStats[0]?.totalUsers || 0,
                    capacity: userStats[0]?.totalCapacity || 0,
                    capacityUsage: userStats[0]?.totalCapacity > 0 
                        ? Math.round((userStats[0].totalUsers / userStats[0].totalCapacity) * 100)
                        : 0
                },
                activity: {
                    totalConnections: userStats[0]?.totalConnections || 0,
                    totalMessages: userStats[0]?.totalMessages || 0
                }
            };

            return stats;
        } catch (error) {
            logger.error('Error getting server statistics:', error);
            throw error;
        }
    }

    // Find popular servers
    async getPopularServers(limit = 10) {
        try {
            const servers = await Server.find({ isOnline: true })
                .sort({ 
                    currentUsers: -1, 
                    totalConnections: -1,
                    totalMessages: -1 
                })
                .limit(limit)
                .select('-password -bannedDevices');

            return servers;
        } catch (error) {
            logger.error('Error getting popular servers:', error);
            throw error;
        }
    }

    // Search servers by name or description
    async searchServers(query, limit = 20) {
        try {
            const searchRegex = new RegExp(query, 'i');
            
            const servers = await Server.find({
                isOnline: true,
                $or: [
                    { name: searchRegex },
                    { description: searchRegex },
                    { tags: { $in: [searchRegex] } }
                ]
            })
            .sort({ currentUsers: -1 })
            .limit(limit)
            .select('-password -bannedDevices');

            return servers;
        } catch (error) {
            logger.error('Error searching servers:', error);
            throw error;
        }
    }

    // Validate server connection details
    async validateServerConnection(ipAddress, port) {
        try {
            const isReachable = await this.pingServer({ ipAddress, port });
            return {
                isReachable,
                message: isReachable 
                    ? 'Server is reachable' 
                    : 'Server is not reachable or not responding'
            };
        } catch (error) {
            return {
                isReachable: false,
                message: `Connection validation failed: ${error.message}`
            };
        }
    }
}

module.exports = new ServerService();