const axios = require('axios');
const logger = require('../utils/logger');

class MainServerService {
    constructor() {
        this.mainServerUrl = process.env.MAIN_SERVER_URL || 'http://localhost:3000';
        this.serverId = process.env.SERVER_ID || null;
        this.serverToken = process.env.SERVER_TOKEN || null;
        this.registrationAttempts = 0;
        this.maxRegistrationAttempts = 5;
        this.isRegistered = false;
        this.lastPingTime = null;
        this.pingInterval = 30000; // 30 seconds
        this.registrationRetryDelay = 60000; // 1 minute
    }

    // Register this chat server with the main server
    async registerWithMainServer() {
        try {
            if (this.registrationAttempts >= this.maxRegistrationAttempts) {
                throw new Error('Maximum registration attempts exceeded');
            }

            const registrationData = {
                name: process.env.SERVER_NAME || 'Unnamed Chat Server',
                ipAddress: process.env.SERVER_IP || this.getLocalIP(),
                port: parseInt(process.env.PORT) || 8080,
                password: process.env.SERVER_PASSWORD || null,
                maxUsers: parseInt(process.env.MAX_USERS) || 100,
                description: process.env.SERVER_DESCRIPTION || '',
                ownerInfo: {
                    contactEmail: process.env.OWNER_EMAIL,
                    contactDiscord: process.env.OWNER_DISCORD
                }
            };

            logger.info('Attempting to register with main server...', {
                mainServerUrl: this.mainServerUrl,
                serverName: registrationData.name,
                serverAddress: `${registrationData.ipAddress}:${registrationData.port}`
            });

            const response = await axios.post(
                `${this.mainServerUrl}/api/servers/register`,
                registrationData,
                {
                    timeout: 10000,
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'ServerChat-ChatServer/1.0.0'
                    }
                }
            );

            if (response.data.success) {
                this.serverId = response.data.serverId;
                this.isRegistered = true;
                this.registrationAttempts = 0;

                logger.info('Successfully registered with main server', {
                    serverId: this.serverId,
                    serverName: registrationData.name
                });

                return {
                    success: true,
                    serverId: this.serverId,
                    message: response.data.message
                };
            } else {
                throw new Error(response.data.message || 'Registration failed');
            }

        } catch (error) {
            this.registrationAttempts++;
            logger.error('Failed to register with main server', {
                attempt: this.registrationAttempts,
                maxAttempts: this.maxRegistrationAttempts,
                error: error.message
            });

            if (this.registrationAttempts < this.maxRegistrationAttempts) {
                logger.info(`Will retry registration in ${this.registrationRetryDelay / 1000} seconds`);
                setTimeout(() => {
                    this.registerWithMainServer();
                }, this.registrationRetryDelay);
            }

            return {
                success: false,
                error: error.message,
                willRetry: this.registrationAttempts < this.maxRegistrationAttempts
            };
        }
    }

    // Send ping to main server with current status
    async pingMainServer(statusData = {}) {
        try {
            if (!this.isRegistered || !this.serverId) {
                // If not registered, attempt registration first
                const registration = await this.registerWithMainServer();
                if (!registration.success) {
                    return { success: false, error: 'Not registered with main server' };
                }
            }

            const pingData = {
                currentUsers: statusData.currentUsers || 0,
                totalMessages: statusData.totalMessages || 0,
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                ...statusData
            };

            const response = await axios.post(
                `${this.mainServerUrl}/api/servers/${this.serverId}/ping`,
                pingData,
                {
                    timeout: 5000,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': this.serverToken ? `Bearer ${this.serverToken}` : undefined,
                        'User-Agent': 'ServerChat-ChatServer/1.0.0'
                    }
                }
            );

            this.lastPingTime = new Date();
            
            logger.debug('Successfully pinged main server', {
                serverId: this.serverId,
                currentUsers: pingData.currentUsers,
                totalMessages: pingData.totalMessages
            });

            return {
                success: true,
                response: response.data,
                timestamp: this.lastPingTime
            };

        } catch (error) {
            logger.error('Failed to ping main server', {
                serverId: this.serverId,
                error: error.message,
                lastSuccessfulPing: this.lastPingTime
            });

            // If unauthorized, try to re-register
            if (error.response?.status === 401 || error.response?.status === 404) {
                logger.info('Server not found on main server, attempting re-registration');
                this.isRegistered = false;
                this.serverId = null;
            }

            return {
                success: false,
                error: error.message,
                lastSuccessfulPing: this.lastPingTime
            };
        }
    }

    // Get server information from main server
    async getServerInfo() {
        try {
            if (!this.serverId) {
                throw new Error('Server not registered');
            }

            const response = await axios.get(
                `${this.mainServerUrl}/api/servers/${this.serverId}`,
                {
                    timeout: 5000,
                    headers: {
                        'Authorization': this.serverToken ? `Bearer ${this.serverToken}` : undefined,
                        'User-Agent': 'ServerChat-ChatServer/1.0.0'
                    }
                }
            );

            return {
                success: true,
                serverInfo: response.data
            };

        } catch (error) {
            logger.error('Failed to get server info from main server', {
                serverId: this.serverId,
                error: error.message
            });

            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get list of all servers from main server
    async getServerList() {
        try {
            const response = await axios.get(
                `${this.mainServerUrl}/api/servers`,
                {
                    timeout: 5000,
                    params: {
                        limit: 50,
                        sort: 'popular'
                    },
                    headers: {
                        'User-Agent': 'ServerChat-ChatServer/1.0.0'
                    }
                }
            );

            return {
                success: true,
                servers: response.data.servers,
                pagination: response.data.pagination
            };

        } catch (error) {
            logger.error('Failed to get server list from main server', {
                error: error.message
            });

            return {
                success: false,
                error: error.message
            };
        }
    }

    // Report user ban to main server
    async reportBan(deviceId, reason, durationMinutes) {
        try {
            if (!this.isRegistered || !this.serverId) {
                return { success: false, error: 'Server not registered' };
            }

            const banData = {
                deviceId,
                reason,
                durationMinutes,
                bannedAt: new Date().toISOString(),
                serverId: this.serverId
            };

            const response = await axios.post(
                `${this.mainServerUrl}/api/servers/${this.serverId}/ban`,
                banData,
                {
                    timeout: 5000,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': this.serverToken ? `Bearer ${this.serverToken}` : undefined,
                        'User-Agent': 'ServerChat-ChatServer/1.0.0'
                    }
                }
            );

            logger.info('Reported ban to main server', {
                deviceId,
                reason,
                durationMinutes
            });

            return {
                success: true,
                response: response.data
            };

        } catch (error) {
            logger.error('Failed to report ban to main server', {
                deviceId,
                error: error.message
            });

            return {
                success: false,
                error: error.message
            };
        }
    }

    // Check main server health
    async checkMainServerHealth() {
        try {
            const response = await axios.get(
                `${this.mainServerUrl}/api/health`,
                {
                    timeout: 5000,
                    headers: {
                        'User-Agent': 'ServerChat-ChatServer/1.0.0'
                    }
                }
            );

            return {
                success: true,
                health: response.data,
                isHealthy: response.data.status === 'OK'
            };

        } catch (error) {
            return {
                success: false,
                error: error.message,
                isHealthy: false
            };
        }
    }

    // Get connection statistics
    getConnectionStats() {
        return {
            isRegistered: this.isRegistered,
            serverId: this.serverId,
            mainServerUrl: this.mainServerUrl,
            lastPingTime: this.lastPingTime,
            registrationAttempts: this.registrationAttempts,
            uptime: process.uptime(),
            nextPingIn: this.lastPingTime 
                ? Math.max(0, this.pingInterval - (Date.now() - this.lastPingTime.getTime()))
                : 0
        };
    }

    // Utility method to get local IP
    getLocalIP() {
        const { networkInterfaces } = require('os');
        const nets = networkInterfaces();
        
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
                if (net.family === 'IPv4' && !net.internal) {
                    return net.address;
                }
            }
        }
        
        return '127.0.0.1'; // fallback
    }

    // Start automatic ping interval
    startPingInterval() {
        if (this.pingIntervalId) {
            clearInterval(this.pingIntervalId);
        }

        this.pingIntervalId = setInterval(async () => {
            try {
                await this.pingMainServer();
            } catch (error) {
                logger.error('Ping interval error:', error);
            }
        }, this.pingInterval);

        logger.info('Started ping interval', { intervalMs: this.pingInterval });
    }

    // Stop automatic ping interval
    stopPingInterval() {
        if (this.pingIntervalId) {
            clearInterval(this.pingIntervalId);
            this.pingIntervalId = null;
            logger.info('Stopped ping interval');
        }
    }

    // Graceful shutdown
    async shutdown() {
        this.stopPingInterval();
        
        if (this.isRegistered && this.serverId) {
            try {
                // Send final ping with offline status
                await this.pingMainServer({ 
                    currentUsers: 0, 
                    status: 'shutting_down' 
                });
                logger.info('Sent shutdown notification to main server');
            } catch (error) {
                logger.error('Failed to send shutdown notification:', error);
            }
        }
    }
}

module.exports = MainServerService;