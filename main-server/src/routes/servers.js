const express = require('express');
const { body, validationResult, param } = require('express-validator');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

const Server = require('../models/Server');
const serverService = require('../services/serverService');
const logger = require('../utils/logger');

const router = express.Router();

// Rate limiting for server registration
const registerLimit = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // limit each IP to 5 registrations per hour
    message: {
        error: 'Çok fazla sunucu kayıt isteği. Lütfen 1 saat sonra tekrar deneyin.'
    }
});

// Validation rules
const serverValidation = [
    body('name')
        .trim()
        .isLength({ min: 3, max: 50 })
        .withMessage('Sunucu adı 3-50 karakter arasında olmalıdır')
        .matches(/^[a-zA-Z0-9\s\-_]+$/)
        .withMessage('Sunucu adı sadece harf, rakam, boşluk, tire ve alt çizgi içerebilir'),
    
    body('ipAddress')
        .isIP(4)
        .withMessage('Geçerli bir IPv4 adresi giriniz'),
    
    body('port')
        .isInt({ min: 1, max: 65535 })
        .withMessage('Port 1-65535 arasında olmalıdır'),
    
    body('password')
        .optional()
        .isLength({ min: 4, max: 50 })
        .withMessage('Şifre 4-50 karakter arasında olmalıdır'),
    
    body('maxUsers')
        .optional()
        .isInt({ min: 1, max: 1000 })
        .withMessage('Maksimum kullanıcı sayısı 1-1000 arasında olmalıdır'),
    
    body('description')
        .optional()
        .trim()
        .isLength({ max: 200 })
        .withMessage('Açıklama maksimum 200 karakter olabilir')
];

// GET /api/servers - List all online servers
router.get('/', async (req, res) => {
    try {
        const { page = 1, limit = 20, sort = 'popular' } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        let sortQuery = {};
        switch (sort) {
            case 'popular':
                sortQuery = { currentUsers: -1, totalConnections: -1 };
                break;
            case 'newest':
                sortQuery = { createdAt: -1 };
                break;
            case 'name':
                sortQuery = { name: 1 };
                break;
            default:
                sortQuery = { currentUsers: -1 };
        }

        const servers = await Server.find({ isOnline: true })
            .sort(sortQuery)
            .skip(skip)
            .limit(limitNum)
            .select('-password -bannedDevices');

        const total = await Server.countDocuments({ isOnline: true });

        res.json({
            servers,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                pages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        logger.error('Server listesi alınırken hata:', error);
        res.status(500).json({ error: 'Sunucu listesi alınamadı' });
    }
});

// POST /api/servers/register - Register a new server
router.post('/register', registerLimit, serverValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation hatası',
                details: errors.array()
            });
        }

        const { name, ipAddress, port, password, maxUsers, description, ownerInfo } = req.body;

        // Check if server already exists
        const existingServer = await Server.findByAddress(ipAddress, port);
        if (existingServer) {
            return res.status(409).json({
                error: 'Bu IP adresi ve port zaten kayıtlı'
            });
        }

        // Create server object
        const serverData = {
            name,
            ipAddress,
            port,
            maxUsers: maxUsers || 100,
            description: description || '',
            ownerInfo: ownerInfo || {}
        };

        // Handle password
        if (password) {
            serverData.hasPassword = true;
            serverData.password = await bcrypt.hash(password, 10);
        }

        const server = new Server(serverData);
        await server.save();

        // Try to ping the server to verify it's running
        const isReachable = await serverService.pingServer(server);
        if (isReachable) {
            server.isOnline = true;
            await server.save();
        }

        logger.info(`Yeni sunucu kaydedildi: ${server.name} (${server.fullAddress})`);

        res.status(201).json({
            success: true,
            message: 'Sunucu başarıyla kaydedildi',
            serverId: server._id,
            server: {
                id: server._id,
                name: server.name,
                ipAddress: server.ipAddress,
                port: server.port,
                hasPassword: server.hasPassword,
                isOnline: server.isOnline,
                maxUsers: server.maxUsers,
                currentUsers: server.currentUsers
            }
        });
    } catch (error) {
        logger.error('Sunucu kayıt hatası:', error);
        res.status(500).json({ error: 'Sunucu kaydedilemedi' });
    }
});

// GET /api/servers/:id - Get server details
router.get('/:id', [
    param('id').isMongoId().withMessage('Geçersiz sunucu ID')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Geçersiz sunucu ID',
                details: errors.array()
            });
        }

        const server = await Server.findById(req.params.id)
            .select('-password -bannedDevices');

        if (!server) {
            return res.status(404).json({ error: 'Sunucu bulunamadı' });
        }

        res.json(server);
    } catch (error) {
        logger.error('Sunucu detayı alınırken hata:', error);
        res.status(500).json({ error: 'Sunucu bilgisi alınamadı' });
    }
});

// POST /api/servers/:id/ping - Server ping endpoint
router.post('/:id/ping', [
    param('id').isMongoId().withMessage('Geçersiz sunucu ID'),
    body('currentUsers').optional().isInt({ min: 0 }).withMessage('Geçersiz kullanıcı sayısı'),
    body('totalMessages').optional().isInt({ min: 0 }).withMessage('Geçersiz mesaj sayısı')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Validation hatası',
                details: errors.array()
            });
        }

        const server = await Server.findById(req.params.id);
        if (!server) {
            return res.status(404).json({ error: 'Sunucu bulunamadı' });
        }

        // Update server status
        await server.ping();

        // Update user count if provided
        if (req.body.currentUsers !== undefined) {
            await server.updateUserCount(req.body.currentUsers);
        }

        // Update stats if provided
        if (req.body.totalMessages !== undefined) {
            server.totalMessages = req.body.totalMessages;
            await server.save();
        }

        res.json({
            success: true,
            message: 'Ping alındı',
            serverStatus: 'online'
        });
    } catch (error) {
        logger.error('Server ping hatası:', error);
        res.status(500).json({ error: 'Ping işlemi başarısız' });
    }
});

// DELETE /api/servers/:id - Delete server (for testing purposes)
router.delete('/:id', [
    param('id').isMongoId().withMessage('Geçersiz sunucu ID')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                error: 'Geçersiz sunucu ID',
                details: errors.array()
            });
        }

        const server = await Server.findById(req.params.id);
        if (!server) {
            return res.status(404).json({ error: 'Sunucu bulunamadı' });
        }

        await Server.findByIdAndDelete(req.params.id);
        logger.info(`Sunucu silindi: ${server.name} (${server.fullAddress})`);

        res.json({
            success: true,
            message: 'Sunucu başarıyla silindi'
        });
    } catch (error) {
        logger.error('Sunucu silme hatası:', error);
        res.status(500).json({ error: 'Sunucu silinemedi' });
    }
});

// GET /api/servers/stats/overview - Get server statistics
router.get('/stats/overview', async (req, res) => {
    try {
        const totalServers = await Server.countDocuments();
        const onlineServers = await Server.countDocuments({ isOnline: true });
        const totalUsers = await Server.aggregate([
            { $match: { isOnline: true } },
            { $group: { _id: null, total: { $sum: '$currentUsers' } } }
        ]);

        const stats = {
            totalServers,
            onlineServers,
            offlineServers: totalServers - onlineServers,
            totalActiveUsers: totalUsers[0]?.total || 0,
            uptime: process.uptime()
        };

        res.json(stats);
    } catch (error) {
        logger.error('İstatistik alınırken hata:', error);
        res.status(500).json({ error: 'İstatistikler alınamadı' });
    }
});

module.exports = router;