const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cron = require('node-cron');
require('dotenv').config();

// Route imports
const serverRoutes = require('./routes/servers');
const healthRoutes = require('./routes/health');

// Middleware imports
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(compression());

// CORS configuration
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Çok fazla istek gönderildi, lütfen daha sonra tekrar deneyin'
    }
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined', {
        stream: {
            write: (message) => logger.info(message.trim())
        }
    }));
}

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/serverchat-main', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => {
    logger.info('MongoDB bağlantısı başarılı');
})
.catch((error) => {
    logger.error('MongoDB bağlantı hatası:', error);
    process.exit(1);
});

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/servers', serverRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: 'ServerChat Ana Sunucusu',
        version: '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString()
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

// Cleanup inactive servers every 5 minutes
cron.schedule('*/5 * * * *', async () => {
    try {
        const { cleanupInactiveServers } = require('./services/serverService');
        await cleanupInactiveServers();
        logger.info('Inactive server cleanup completed');
    } catch (error) {
        logger.error('Cleanup error:', error);
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    mongoose.connection.close(() => {
        logger.info('MongoDB connection closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    mongoose.connection.close(() => {
        logger.info('MongoDB connection closed');
        process.exit(0);
    });
});

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        logger.info(`Ana sunucu ${PORT} portunda çalışıyor`);
        logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
}

module.exports = app;