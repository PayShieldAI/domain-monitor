const express = require('express');
const healthRoutes = require('./health');
const authRoutes = require('./auth');
const userRoutes = require('./users');
const domainRoutes = require('./domains');

const router = express.Router();

// Health check (public)
router.use('/health', healthRoutes);

// API v1 routes
router.use('/api/v1/auth', authRoutes);
router.use('/api/v1/users', userRoutes);
router.use('/api/v1/domains', domainRoutes);
// router.use('/api/v1/webhooks', webhookRoutes);
// router.use('/api/v1/events', eventRoutes);
// router.use('/api/v1/admin', adminRoutes);

module.exports = router;
