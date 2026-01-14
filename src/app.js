const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');

const routes = require('./routes');
const errorHandler = require('./middlewares/errorHandler');
const requestLogger = require('./middlewares/requestLogger');

const app = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Compression
app.use(compression());

// Request logging
app.use(requestLogger);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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
