const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
require('dotenv').config();

// Service imports
const ChatService = require('./services/ChatService');
const UserService = require('./services/UserService');
const BanService = require('./services/BanService');
const MainServerService = require('./services/MainServerService');

// Route imports
const authRoutes = require('./routes/auth');
const healthRoutes = require('./routes/health');
const adminRoutes = require('./routes/admin');

// Middleware imports
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ["*"],
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 8080;

// Initialize services
const chatService = new ChatService();
const userService = new UserService();
const banService = new BanService();
const mainServerService = new MainServerService();

// Security middleware
app.use(helmet());
app.use(compression());

// CORS configuration
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // limit each IP to 200 requests per windowMs
    message: {
        error: 'Çok fazla istek gönderildi, lütfen daha sonra tekrar deneyin'
    }
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Logging
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined', {
        stream: {
            write: (message) => logger.info(message.trim())
        }
    }));
}

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'ServerChat Chat Sunucusu',
        version: '1.0.0',
        status: 'running',
        serverName: process.env.SERVER_NAME || 'Unnamed Server',
        maxUsers: parseInt(process.env.MAX_USERS) || 100,
        currentUsers: userService.getOnlineUserCount(),
        hasPassword: !!process.env.SERVER_PASSWORD,
        timestamp: new Date().toISOString()
    });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    logger.info(`New socket connection: ${socket.id}`);

    // Authentication
    socket.on('auth', async (data) => {
        try {
            const { token, username, deviceId } = data;
            
            // Validate token and user
            const user = await userService.authenticateUser(token, username, deviceId);
            if (!user) {
                socket.emit('auth_error', { message: 'Geçersiz kimlik doğrulama' });
                return;
            }

            // Check if user is banned
            const banInfo = banService.isUserBanned(user.deviceId);
            if (banInfo.banned) {
                socket.emit('auth_error', { 
                    message: 'Bu cihaz banlandı',
                    banExpiry: banInfo.expiry,
                    reason: banInfo.reason
                });
                return;
            }

            // Check server capacity
            if (userService.getOnlineUserCount() >= (parseInt(process.env.MAX_USERS) || 100)) {
                socket.emit('auth_error', { message: 'Sunucu dolu' });
                return;
            }

            // Add user to server
            userService.addUser(socket.id, user);
            socket.userId = user.id;
            socket.username = user.username;
            socket.deviceId = user.deviceId;

            // Join main room
            socket.join('main');

            // Send authentication success
            socket.emit('auth_success', {
                userId: user.id,
                username: user.username,
                message: 'Başarıyla bağlandınız'
            });

            // Broadcast user joined
            socket.to('main').emit('user_joined', {
                type: 'user_joined',
                user: {
                    id: user.id,
                    username: user.username,
                    joinedAt: new Date().toISOString()
                }
            });

            // Send current online users
            socket.emit('user_list', {
                type: 'user_list',
                users: userService.getOnlineUsers()
            });

            // Send recent messages
            const recentMessages = chatService.getRecentMessages(50);
            socket.emit('message_history', {
                type: 'message_history',
                messages: recentMessages
            });

            logger.info(`User authenticated: ${user.username} (${socket.id})`);
        } catch (error) {
            logger.error('Authentication error:', error);
            socket.emit('auth_error', { message: 'Kimlik doğrulama hatası' });
        }
    });

    // Message handling
    socket.on('message', (data) => {
        try {
            if (!socket.userId) {
                socket.emit('error', { message: 'Önce kimlik doğrulama yapın' });
                return;
            }

            const { content, type = 'text' } = data;
            
            // Validate message
            if (!content || content.trim().length === 0) {
                return;
            }

            if (content.length > 1000) {
                socket.emit('error', { message: 'Mesaj çok uzun (max 1000 karakter)' });
                return;
            }

            // Check spam
            const spamCheck = banService.checkSpam(socket.deviceId);
            if (spamCheck.isSpam) {
                if (spamCheck.shouldBan) {
                    banService.banUser(socket.deviceId, 'Spam', 60); // 60 minutes ban
                    socket.emit('banned', { 
                        message: 'Spam nedeniyle banlandınız',
                        duration: 60,
                        reason: 'Spam'
                    });
                    socket.disconnect();
                    return;
                } else {
                    socket.emit('warning', { 
                        message: `Çok hızlı mesaj gönderiyorsunuz. Kalan hak: ${spamCheck.remainingMessages}` 
                    });
                    return;
                }
            }

            // Create message
            const message = chatService.createMessage({
                senderId: socket.userId,
                senderName: socket.username,
                content: content.trim(),
                type
            });

            // Broadcast message to all users in main room
            io.to('main').emit('message', message);

            logger.debug(`Message from ${socket.username}: ${content}`);
        } catch (error) {
            logger.error('Message handling error:', error);
            socket.emit('error', { message: 'Mesaj gönderilemedi' });
        }
    });

    // Typing indicator
    socket.on('typing_start', () => {
        if (socket.userId) {
            socket.to('main').emit('user_typing', {
                userId: socket.userId,
                username: socket.username,
                typing: true
            });
        }
    });

    socket.on('typing_stop', () => {
        if (socket.userId) {
            socket.to('main').emit('user_typing', {
                userId: socket.userId,
                username: socket.username,
                typing: false
            });
        }
    });

    // Disconnect handling
    socket.on('disconnect', (reason) => {
        if (socket.userId) {
            const user = userService.getUser(socket.id);
            if (user) {
                // Remove user
                userService.removeUser(socket.id);

                // Broadcast user left
                socket.to('main').emit('user_left', {
                    type: 'user_left',
                    userId: socket.userId,
                    username: socket.username,
                    reason
                });

                logger.info(`User disconnected: ${socket.username} (${socket.id}) - ${reason}`);
            }
        } else {
            logger.info(`Socket disconnected: ${socket.id} - ${reason}`);
        }
    });

    // Error handling
    socket.on('error', (error) => {
        logger.error(`Socket error for ${socket.id}:`, error);
    });
});

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint bulunamadı',
        path: req.originalUrl
    });
});

// Ping main server every 30 seconds
cron.schedule('*/30 * * * * *', async () => {
    try {
        await mainServerService.pingMainServer({
            currentUsers: userService.getOnlineUserCount(),
            totalMessages: chatService.getTotalMessageCount()
        });
    } catch (error) {
        logger.error('Main server ping failed:', error);
    }
});

// Clean up old messages every hour
cron.schedule('0 * * * *', () => {
    try {
        const cleaned = chatService.cleanOldMessages();
        if (cleaned > 0) {
            logger.info(`Cleaned ${cleaned} old messages`);
        }
    } catch (error) {
        logger.error('Message cleanup error:', error);
    }
});

// Clean up expired bans every 10 minutes
cron.schedule('*/10 * * * *', () => {
    try {
        const cleaned = banService.cleanExpiredBans();
        if (cleaned > 0) {
            logger.info(`Cleaned ${cleaned} expired bans`);
        }
    } catch (error) {
        logger.error('Ban cleanup error:', error);
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });
});

if (process.env.NODE_ENV !== 'test') {
    server.listen(PORT, () => {
        logger.info(`Chat sunucusu ${PORT} portunda çalışıyor`);
        logger.info(`Server Name: ${process.env.SERVER_NAME || 'Unnamed Server'}`);
        logger.info(`Max Users: ${process.env.MAX_USERS || 100}`);
        logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
}

module.exports = { app, server, io };