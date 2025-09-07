const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log error
    logger.error(`Error ${err.message}`, {
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        body: req.method === 'POST' ? JSON.stringify(req.body) : undefined
    });

    // Socket.IO errors
    if (err.name === 'SocketError') {
        const message = 'WebSocket bağlantı hatası';
        error = { message, statusCode: 500 };
    }

    // JWT error
    if (err.name === 'JsonWebTokenError') {
        const message = 'Geçersiz token';
        error = { message, statusCode: 401 };
    }

    // JWT expired
    if (err.name === 'TokenExpiredError') {
        const message = 'Token süresi dolmuş';
        error = { message, statusCode: 401 };
    }

    // Validation errors
    if (err.name === 'ValidationError') {
        const message = 'Geçersiz veri';
        error = { message, statusCode: 400 };
    }

    // Rate limit error
    if (err.status === 429) {
        const message = 'Çok fazla istek gönderildi';
        error = { message, statusCode: 429 };
    }

    // Request timeout
    if (err.code === 'ECONNABORTED') {
        const message = 'İstek zaman aşımına uğradı';
        error = { message, statusCode: 408 };
    }

    // Network errors
    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
        const message = 'Ağ bağlantısı hatası';
        error = { message, statusCode: 503 };
    }

    // File system errors
    if (err.code === 'ENOENT') {
        const message = 'Dosya bulunamadı';
        error = { message, statusCode: 404 };
    }

    if (err.code === 'EACCES') {
        const message = 'Dosya erişim hatası';
        error = { message, statusCode: 403 };
    }

    // Memory errors
    if (err.code === 'ENOMEM') {
        const message = 'Yetersiz bellek';
        error = { message, statusCode: 507 };
    }

    // Default error
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Sunucu hatası';

    res.status(statusCode).json({
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && { 
            stack: err.stack,
            details: error 
        })
    });
};

module.exports = errorHandler;