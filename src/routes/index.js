const express = require('express');
const healthRoutes = require('./health');
const authRoutes = require('./auth');
const userRoutes = require('./users');
const domainRoutes = require('./domains');
const providerRoutes = require('./providers');
const webhookRoutes = require('./webhookRoutes');
const apiKeyRoutes = require('./apiKeyRoutes');
const userWebhookRoutes = require('./userWebhookRoutes');

const router = express.Router();

// Health check (public)
router.use('/health', healthRoutes);

// API v1 routes
router.use('/api/v1/auth', authRoutes);
router.use('/api/v1/users', userRoutes);
router.use('/api/v1/domains', domainRoutes);
router.use('/api/v1/admin/providers', providerRoutes);
router.use('/api/v1/admin/api-keys', apiKeyRoutes);
router.use('/api/v1/webhooks', webhookRoutes);
router.use('/api/v1/user-webhooks', userWebhookRoutes);
// router.use('/api/v1/events', eventRoutes);

module.exports = router;
