const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const UserService = require('../services/UserService');
const ChatService = require('../services/ChatService');
const BanService = require('../services/BanService');
const MainServerService = require('../services/MainServerService');
const logger = require('../utils/logger');

const router = express.Router();

// Initialize services
const userService = new UserService();
const chatService = new ChatService();
const banService = new BanService();
const mainServerService = new MainServerService();

// Admin authentication middleware
const adminAuth = (req, res, next) => {
    const adminKey = req.headers['x-admin-key'] || req.query.adminKey;
    const expectedKey = process.env.ADMIN_KEY;

    if (!expectedKey) {
        return res.status(503).json({
            error: 'Admin panel is not configured'
        });
    }

    if (!adminKey || adminKey !== expectedKey) {
        logger.warn('Unauthorized admin access attempt', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path
        });
        return res.status(401).json({
            error: 'Unauthorized'
        });
    }

    next();
};

// Rate limiting for admin endpoints
const adminLimit = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 50, // limit each IP to 50 requests per windowMs
    message: {
        error: 'Çok fazla admin isteği'
    }
});

// Apply middleware to all admin routes
router.use(adminLimit);
router.use(adminAuth);

// GET /api/admin/dashboard - Admin dashboard data
router.get('/dashboard', (req, res) => {
    try {
        const userStats = userService.getUserStats();
        const messageStats = chatService.getMessageStats();
        const banStats = banService.getBanStats();
        const connectionStats = mainServerService.getConnectionStats();

        const dashboard = {
            timestamp: new Date().toISOString(),
            server: {
                name: process.env.SERVER_NAME || 'Chat Server',
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                version: '1.0.0'
            },
            users: userStats,
            messages: messageStats,
            security: banStats,
            mainServer: {
                connected: connectionStats.isRegistered,
                lastPing: connectionStats.lastPingTime,
                serverId: connectionStats.serverId
            },
            recentActivity: {
                onlineUsers: userService.getOnlineUsers(),
                recentMessages: chatService.getRecentMessages(10),
                activeBans: banService.getBannedUsers().slice(0, 10)
            }
        };

        res.json(dashboard);
    } catch (error) {
        logger.error('Admin dashboard error:', error);
        res.status(500).json({ error: 'Dashboard verisi alınamadı' });
    }
});

// GET /api/admin/users - Get all users
router.get('/users', (req, res) => {
    try {
        const { includeHistory = 'false' } = req.query;
        
        const response = {
            onlineUsers: userService.getOnlineUsers(),
            stats: userService.getUserStats()
        };

        if (includeHistory === 'true') {
            response.connectionHistory = userService.getConnectionHistory(100);
        }

        res.json(response);
    } catch (error) {
        logger.error('Admin users error:', error);
        res.status(500).json({ error: 'Kullanıcı verisi alınamadı' });
    }
});

// POST /api/admin/users/:socketId/kick - Kick a user
router.post('/users/:socketId/kick', [
    param('socketId').isLength({ min: 1 }).withMessage('Socket ID gerekli'),
    body('reason').optional().isLength({ max: 200 }).withMessage('Sebep çok uzun')
], (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { socketId } = req.params;
        const { reason = 'Yönetici tarafından atıldı' } = req.body;

        const result = userService.kickUser(socketId, reason);
        
        if (result.success) {
            logger.info('User kicked by admin', {
                socketId,
                username: result.user.username,
                reason
            });
            
            res.json({
                success: true,
                message: 'Kullanıcı atıldı',
                user: result.user,
                reason
            });
        } else {
            res.status(404).json({
                success: false,
                error: result.reason
            });
        }
    } catch (error) {
        logger.error('Admin kick error:', error);
        res.status(500).json({ error: 'Kullanıcı atılamadı' });
    }
});

// POST /api/admin/users/:socketId/mute - Mute a user
router.post('/users/:socketId/mute', [
    param('socketId').isLength({ min: 1 }).withMessage('Socket ID gerekli'),
    body('duration').optional().isInt({ min: 1, max: 1440 }).withMessage('Süre 1-1440 dakika arası olmalı')
], (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { socketId } = req.params;
        const { duration = 10 } = req.body;

        const result = userService.muteUser(socketId, duration);
        
        if (result.success) {
            logger.info('User muted by admin', {
                socketId,
                username: result.user.username,
                duration
            });
            
            res.json({
                success: true,
                message: 'Kullanıcı susturuldu',
                user: result.user,
                muteExpiry: result.muteExpiry
            });
        } else {
            res.status(404).json({
                success: false,
                error: result.reason
            });
        }
    } catch (error) {
        logger.error('Admin mute error:', error);
        res.status(500).json({ error: 'Kullanıcı susturulamadı' });
    }
});

// DELETE /api/admin/users/:socketId/mute - Unmute a user
router.delete('/users/:socketId/mute', [
    param('socketId').isLength({ min: 1 }).withMessage('Socket ID gerekli')
], (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { socketId } = req.params;
        const result = userService.unmuteUser(socketId);
        
        if (result.success) {
            logger.info('User unmuted by admin', {
                socketId,
                username: result.user.username
            });
            
            res.json({
                success: true,
                message: 'Kullanıcının susturması kaldırıldı',
                user: result.user
            });
        } else {
            res.status(404).json({
                success: false,
                error: result.reason
            });
        }
    } catch (error) {
        logger.error('Admin unmute error:', error);
        res.status(500).json({ error: 'Kullanıcının susturması kaldırılamadı' });
    }
});

// GET /api/admin/messages - Get messages with filters
router.get('/messages', [
    query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit 1-1000 arası olmalı'),
    query('search').optional().isLength({ max: 100 }).withMessage('Arama terimi çok uzun')
], (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { limit = 50, search } = req.query;
        let messages;

        if (search) {
            messages = chatService.searchMessages(search, parseInt(limit));
        } else {
            messages = chatService.getRecentMessages(parseInt(limit));
        }

        res.json({
            messages,
            stats: chatService.getMessageStats(),
            total: chatService.getTotalMessageCount()
        });
    } catch (error) {
        logger.error('Admin messages error:', error);
        res.status(500).json({ error: 'Mesajlar alınamadı' });
    }
});

// DELETE /api/admin/messages/:messageId - Delete a message
router.delete('/messages/:messageId', [
    param('messageId').isUUID().withMessage('Geçersiz mesaj ID')
], (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { messageId } = req.params;
        const deleted = chatService.deleteMessage(messageId, 'admin');
        
        if (deleted) {
            logger.info('Message deleted by admin', { messageId });
            res.json({
                success: true,
                message: 'Mesaj silindi'
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Mesaj bulunamadı'
            });
        }
    } catch (error) {
        logger.error('Admin delete message error:', error);
        res.status(500).json({ error: 'Mesaj silinemedi' });
    }
});

// GET /api/admin/bans - Get ban information
router.get('/bans', (req, res) => {
    try {
        const { includeExpired = 'false' } = req.query;
        
        res.json({
            stats: banService.getBanStats(),
            bans: banService.getBannedUsers(includeExpired === 'true')
        });
    } catch (error) {
        logger.error('Admin bans error:', error);
        res.status(500).json({ error: 'Ban verisi alınamadı' });
    }
});

// POST /api/admin/bans - Ban a device
router.post('/bans', [
    body('deviceId').isLength({ min: 10, max: 100 }).withMessage('Geçersiz cihaz ID'),
    body('reason').isLength({ min: 1, max: 200 }).withMessage('Sebep gerekli (max 200 karakter)'),
    body('duration').isInt({ min: 1, max: 10080 }).withMessage('Süre 1-10080 dakika arası olmalı')
], (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { deviceId, reason, duration } = req.body;
        const ban = banService.banUser(deviceId, reason, duration, 'admin');
        
        logger.info('Device banned by admin', {
            deviceId: deviceId.substring(0, 8) + '...',
            reason,
            duration
        });

        res.json({
            success: true,
            message: 'Cihaz banlandı',
            ban: {
                id: ban.id,
                deviceId: ban.deviceId,
                reason: ban.reason,
                expiresAt: ban.expiresAt,
                durationMinutes: ban.durationMinutes
            }
        });
    } catch (error) {
        logger.error('Admin ban error:', error);
        res.status(500).json({ error: 'Cihaz banlanamadı' });
    }
});

// DELETE /api/admin/bans/:deviceId - Unban a device
router.delete('/bans/:deviceId', [
    param('deviceId').isLength({ min: 10, max: 100 }).withMessage('Geçersiz cihaz ID')
], (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { deviceId } = req.params;
        const result = banService.unbanUser(deviceId, 'admin');
        
        if (result.success) {
            logger.info('Device unbanned by admin', {
                deviceId: deviceId.substring(0, 8) + '...'
            });
            
            res.json({
                success: true,
                message: 'Cihaz banı kaldırıldı'
            });
        } else {
            res.status(404).json({
                success: false,
                error: result.reason
            });
        }
    } catch (error) {
        logger.error('Admin unban error:', error);
        res.status(500).json({ error: 'Cihaz banı kaldırılamadı' });
    }
});

// POST /api/admin/bans/mass-unban - Mass unban
router.post('/bans/mass-unban', (req, res) => {
    try {
        const result = banService.massUnban('Mass unban by admin');
        
        logger.info('Mass unban performed by admin', {
            unbannedCount: result.unbannedCount
        });
        
        res.json({
            success: true,
            message: `${result.unbannedCount} cihazın banı kaldırıldı`,
            unbannedCount: result.unbannedCount
        });
    } catch (error) {
        logger.error('Admin mass unban error:', error);
        res.status(500).json({ error: 'Toplu ban kaldırma başarısız' });
    }
});

// GET /api/admin/logs - Get server logs (if available)
router.get('/logs', [
    query('lines').optional().isInt({ min: 1, max: 1000 }).withMessage('Satır sayısı 1-1000 arası olmalı')
], (req, res) => {
    try {
        const { lines = 100 } = req.query;
        
        // This would read from log files in a real implementation
        res.json({
            message: 'Log endpoint not implemented',
            note: 'Logs are available in the logs/ directory'
        });
    } catch (error) {
        logger.error('Admin logs error:', error);
        res.status(500).json({ error: 'Log verisi alınamadı' });
    }
});

// POST /api/admin/server/broadcast - Broadcast message to all users
router.post('/server/broadcast', [
    body('message').isLength({ min: 1, max: 500 }).withMessage('Mesaj 1-500 karakter arası olmalı'),
    body('type').optional().isIn(['info', 'warning', 'error']).withMessage('Geçersiz mesaj tipi')
], (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { message, type = 'info' } = req.body;
        
        const systemMessage = chatService.createSystemMessage(
            `📢 Yönetici Duyurusu: ${message}`,
            'announcement'
        );

        logger.info('Admin broadcast message', { message, type });
        
        res.json({
            success: true,
            message: 'Duyuru gönderildi',
            broadcastMessage: systemMessage
        });
    } catch (error) {
        logger.error('Admin broadcast error:', error);
        res.status(500).json({ error: 'Duyuru gönderilemedi' });
    }
});

// GET /api/admin/export - Export server data
router.get('/export', [
    query('type').isIn(['messages', 'bans', 'users', 'all']).withMessage('Geçersiz export tipi')
], (req, res) => {
    try {
        const { type = 'all' } = req.query;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        
        let exportData = {
            serverName: process.env.SERVER_NAME || 'Chat Server',
            exportedAt: new Date().toISOString(),
            exportType: type
        };

        switch (type) {
            case 'messages':
                exportData.messages = chatService.getRecentMessages(1000);
                break;
            case 'bans':
                exportData.bans = banService.exportBans();
                break;
            case 'users':
                exportData.users = {
                    online: userService.getOnlineUsers(),
                    stats: userService.getUserStats(),
                    history: userService.getConnectionHistory(500)
                };
                break;
            case 'all':
                exportData.messages = chatService.getRecentMessages(1000);
                exportData.bans = banService.exportBans();
                exportData.users = {
                    online: userService.getOnlineUsers(),
                    stats: userService.getUserStats(),
                    history: userService.getConnectionHistory(500)
                };
                break;
        }

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="server-export-${type}-${timestamp}.json"`);
        res.json(exportData);
    } catch (error) {
        logger.error('Admin export error:', error);
        res.status(500).json({ error: 'Veri export edilemedi' });
    }
});

module.exports = router;