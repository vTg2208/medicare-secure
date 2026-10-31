const rateLimit = require('express-rate-limit');
const { HTTP_STATUS, ERROR_MESSAGES, RATE_LIMITS } = require('../utils/constants');
const config = require('../config/env');
const logger = require('../utils/logger');

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP
 */
const apiLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: {
        success: false,
        message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn('API rate limit exceeded:', {
            ip: req.ip,
            path: req.path,
        });

        res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
            success: false,
            message: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
        });
    },
});

/**
 * Login rate limiter
 * 5 attempts per 15 minutes per IP
 */
const loginLimiter = rateLimit({
    windowMs: config.rateLimit.loginWindowMs,
    max: config.rateLimit.loginMaxAttempts,
    message: {
        success: false,
        message: 'Too many login attempts. Please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true, // Don't count successful logins
    handler: (req, res) => {
        logger.warn('Login rate limit exceeded:', {
            ip: req.ip,
            email: req.body.email || req.body.phone,
        });

        res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
            success: false,
            message: 'Too many login attempts. Please try again after 15 minutes.',
        });
    },
});

/**
 * OTP request rate limiter
 * 3 attempts per hour per IP
 */
const otpLimiter = rateLimit({
    windowMs: config.rateLimit.otpWindowMs,
    max: config.rateLimit.otpMaxAttempts,
    message: {
        success: false,
        message: 'Too many OTP requests. Please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn('OTP rate limit exceeded:', {
            ip: req.ip,
            email: req.body.email || req.body.phone,
        });

        res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
            success: false,
            message: 'Too many OTP requests. Please try again after 1 hour.',
        });
    },
});

/**
 * Registration rate limiter
 * 3 registrations per hour per IP
 */
const registrationLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: {
        success: false,
        message: 'Too many requests from this IP, please try again after 15 minutes',
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn('Registration rate limit exceeded:', {
            ip: req.ip,
        });

        res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
            success: false,
            message: 'Too many registration attempts. Please try again after 1 hour.',
        });
    },
});

/**
 * Password reset rate limiter
 * 3 attempts per hour per IP
 */
const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    message: {
        success: false,
        message: 'Too many password reset attempts. Please try again later.',
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        logger.warn('Password reset rate limit exceeded:', {
            ip: req.ip,
        });

        res.status(HTTP_STATUS.TOO_MANY_REQUESTS).json({
            success: false,
            message: 'Too many password reset attempts. Please try again after 1 hour.',
        });
    },
});

module.exports = {
    apiLimiter,
    loginLimiter,
    otpLimiter,
    registrationLimiter,
    passwordResetLimiter,
};
