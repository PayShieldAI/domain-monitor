const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const path = require('path');

const config = require('./config');
const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const requestLogger = require('./middlewares/requestLogger');
const apiLogger = require('./middlewares/apiLogger');

const app = express();

// Security middleware - Configure helmet to allow Swagger UI to work
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      imgSrc: ["'self'", "data:", "https://validator.swagger.io"],
      fontSrc: ["'self'", "https://unpkg.com"]
    }
  }
}));
app.use(cors());

// Compression
app.use(compression());

// Request logging
app.use(requestLogger);

// Body parsing with raw body capture for webhook signature verification
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf, encoding) => {
    // Save raw body for webhook signature verification
    if (req.url.startsWith('/api/v1/webhooks/')) {
      req.rawBody = buf.toString(encoding || 'utf8');
    }
  }
}));
app.use(express.urlencoded({ extended: true }));

// API request/response logging to database
app.use(apiLogger({
  enabled: config.apiLogging.enabled,
  logRequestBody: config.apiLogging.logRequestBody,
  logResponseBody: config.apiLogging.logResponseBody,
  skipPaths: ['/health', '/metrics', '/docs']
}));

// Serve API documentation
app.use('/docs', express.static(path.join(__dirname, '../docs')));

// Routes
app.use(routes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found'
    }
  });
});

// Error handler
app.use(errorHandler);

module.exports = app;
