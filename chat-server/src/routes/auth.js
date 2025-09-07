const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

const BanService = require('../services/BanService');
const logger = require('../utils/logger');

const router = express.Router();
const banService = new BanService();

// Rate limiting for auth endpoints
const authLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests per windowMs
    message: {
        error: 'Çok fazla kimlik doğrulama isteği. Lütfen 15 dakika sonra tekrar deneyin.'
    }
});

// Validation rules
const connectValidation = [
    body('username')
        .trim()
        .isLength({ min: 3, max: 20 })
        .withMessage('Kullanıcı adı 3-20 karakter arasında olmalıdır')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Kullanıcı adı sadece harf, rakam, tire ve alt çizgi içerebilir'),
    
    body('password')
        .optional()
        .isLength({ min: 1, max: 50 })
        .withMessage('Şifre 1-50 karakter arasında olmalıdır'),
    
    body('deviceId')
        .isLength({ min: 10, max: 100 })
        .withMessage('Geçersiz cihaz ID')
];

// POST /api/auth/connect - Connect to server
router.post('/connect', authLimit, connectValidation, async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Geçersiz veri',
                errors: errors.array()
            });
        }

        const { username, password, deviceId } = req.body;
        const clientIP = req.ip || req.connection.remoteAddress;

        // Check if device is banned
        const banCheck = banService.isUserBanned(deviceId);
        if (banCheck.banned) {
            const remainingMinutes = Math.ceil(banCheck.remainingTime / (1000 * 60));
            return res.status(403).json({
                success: false,
                message: `Bu cihaz banlandı. Kalan süre: ${remainingMinutes} dakika`,
                banExpiry: banCheck.expiry,
                reason: banCheck.reason
            });
        }

        // Check server password if set
        if (process.env.SERVER_PASSWORD) {
            if (!password) {
                const failedLogin = banService.trackFailedLogin(deviceId, username);
                return res.status(401).json({
                    success: false,
                    message: 'Bu sunucu şifre gerektiriyor',
                    requiresPassword: true,
                    remainingAttempts: failedLogin.remaining
                });
            }

            const isPasswordValid = await bcrypt.compare(password, process.env.SERVER_PASSWORD);
            if (!isPasswordValid) {
                const failedLogin = banService.trackFailedLogin(deviceId, username);
                
                if (failedLogin.banned) {
                    return res.status(403).json({
                        success: false,
                        message: failedLogin.reason,
                        banned: true
                    });
                }

                return res.status(401).json({
                    success: false,
                    message: 'Yanlış şifre',
                    remainingAttempts: failedLogin.remaining
                });
            }
        }

        // Clear failed login attempts on successful auth
        banService.clearFailedLogins(deviceId);

        // Generate JWT token for the session
        const token = jwt.sign(
            {
                deviceId,
                username,
                connectedAt: new Date().toISOString(),
                serverName: process.env.SERVER_NAME || 'Chat Server'
            },
            process.env.JWT_SECRET || 'default-secret',
            { expiresIn: '24h' }
        );

        logger.info('User connected successfully', {
            username,
            deviceId: deviceId.substring(0, 8) + '...',
            ip: clientIP
        });

        res.json({
            success: true,
            message: 'Başarıyla bağlandınız',
            token,
            userId: `user_${deviceId.substring(0, 8)}`,
            serverInfo: {
                name: process.env.SERVER_NAME || 'Chat Server',
                maxUsers: parseInt(process.env.MAX_USERS) || 100,
                hasPassword: !!process.env.SERVER_PASSWORD,
                description: process.env.SERVER_DESCRIPTION || ''
            }
        });

    } catch (error) {
        logger.error('Connection error:', error);
        res.status(500).json({
            success: false,
            message: 'Bağlantı hatası'
        });
    }
});

// POST /api/auth/verify - Verify JWT token
router.post('/verify', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token gerekli'
            });
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default-secret');
            
            // Check if device is still not banned
            const banCheck = banService.isUserBanned(decoded.deviceId);
            if (banCheck.banned) {
                return res.status(403).json({
                    success: false,
                    message: 'Cihaz banlandı',
                    banned: true
                });
            }

            res.json({
                success: true,
                message: 'Token geçerli',
                user: {
                    deviceId: decoded.deviceId,
                    username: decoded.username,
                    connectedAt: decoded.connectedAt
                }
            });

        } catch (jwtError) {
            return res.status(401).json({
                success: false,
                message: 'Geçersiz token'
            });
        }

    } catch (error) {
        logger.error('Token verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Token doğrulama hatası'
        });
    }
});

// GET /api/auth/server-info - Get server information
router.get('/server-info', (req, res) => {
    res.json({
        success: true,
        serverInfo: {
            name: process.env.SERVER_NAME || 'Chat Server',
            description: process.env.SERVER_DESCRIPTION || '',
            maxUsers: parseInt(process.env.MAX_USERS) || 100,
            hasPassword: !!process.env.SERVER_PASSWORD,
            version: '1.0.0',
            uptime: process.uptime(),
            features: [
                'real-time-chat',
                'user-management',
                'spam-protection',
                'ban-system'
            ]
        }
    });
});

// POST /api/auth/guest - Connect as guest (no password required)
router.post('/guest', authLimit, [
    body('username')
        .trim()
        .isLength({ min: 3, max: 20 })
        .withMessage('Kullanıcı adı 3-20 karakter arasında olmalıdır')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Kullanıcı adı sadece harf, rakam, tire ve alt çizgi içerebilir'),
    
    body('deviceId')
        .isLength({ min: 10, max: 100 })
        .withMessage('Geçersiz cihaz ID')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Geçersiz veri',
                errors: errors.array()
            });
        }

        // If server requires password, reject guest connections
        if (process.env.SERVER_PASSWORD && process.env.REQUIRE_PASSWORD_FOR_GUESTS !== 'false') {
            return res.status(403).json({
                success: false,
                message: 'Bu sunucu misafir kullanıcılara izin vermiyor',
                requiresPassword: true
            });
        }

        const { username, deviceId } = req.body;

        // Check if device is banned
        const banCheck = banService.isUserBanned(deviceId);
        if (banCheck.banned) {
            const remainingMinutes = Math.ceil(banCheck.remainingTime / (1000 * 60));
            return res.status(403).json({
                success: false,
                message: `Bu cihaz banlandı. Kalan süre: ${remainingMinutes} dakika`,
                banExpiry: banCheck.expiry,
                reason: banCheck.reason
            });
        }

        // Generate guest token
        const token = jwt.sign(
            {
                deviceId,
                username: `Guest_${username}`,
                isGuest: true,
                connectedAt: new Date().toISOString()
            },
            process.env.JWT_SECRET || 'default-secret',
            { expiresIn: '2h' } // Shorter expiry for guests
        );

        logger.info('Guest user connected', {
            username: `Guest_${username}`,
            deviceId: deviceId.substring(0, 8) + '...',
            ip: req.ip
        });

        res.json({
            success: true,
            message: 'Misafir olarak bağlandınız',
            token,
            userId: `guest_${deviceId.substring(0, 8)}`,
            isGuest: true,
            serverInfo: {
                name: process.env.SERVER_NAME || 'Chat Server',
                maxUsers: parseInt(process.env.MAX_USERS) || 100
            }
        });

    } catch (error) {
        logger.error('Guest connection error:', error);
        res.status(500).json({
            success: false,
            message: 'Bağlantı hatası'
        });
    }
});

module.exports = router;