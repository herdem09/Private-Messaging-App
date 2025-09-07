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
        userAgent: req.get('User-Agent')
    });

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        const message = 'Geçersiz ID formatı';
        error = { message, statusCode: 400 };
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const message = 'Bu kayıt zaten mevcut';
        error = { message, statusCode: 409 };
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message).join(', ');
        error = { message, statusCode: 400 };
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

    // Request timeout
    if (err.code === 'ECONNABORTED') {
        const message = 'İstek zaman aşımına uğradı';
        error = { message, statusCode: 408 };
    }

    // Rate limit error
    if (err.status === 429) {
        const message = 'Çok fazla istek gönderildi';
        error = { message, statusCode: 429 };
    }

    // Default error
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Sunucu hatası';

    res.status(statusCode).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

module.exports = errorHandler;