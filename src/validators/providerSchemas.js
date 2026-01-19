const Joi = require('joi');

/**
 * Create provider schema
 */
const createProviderSchema = Joi.object({
  name: Joi.string()
    .lowercase()
    .pattern(/^[a-z0-9_-]+$/)
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.pattern.base': 'Provider name must contain only lowercase letters, numbers, hyphens, and underscores'
    }),
  displayName: Joi.string()
    .min(2)
    .max(100)
    .required(),
  apiBaseUrl: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .max(500)
    .required(),
  apiKey: Joi.string()
    .min(10)
    .max(500)
    .required()
    .messages({
      'string.min': 'API key must be at least 10 characters'
    }),
  enabled: Joi.boolean()
    .default(true),
  priority: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .default(100)
    .messages({
      'number.min': 'Priority must be at least 1 (lower = higher priority)',
      'number.max': 'Priority must not exceed 1000'
    }),
  rateLimit: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .default(60)
    .messages({
      'number.min': 'Rate limit must be at least 1 request per minute'
    }),
  timeout: Joi.number()
    .integer()
    .min(1000)
    .max(60000)
    .default(10000)
    .messages({
      'number.min': 'Timeout must be at least 1000ms (1 second)',
      'number.max': 'Timeout must not exceed 60000ms (60 seconds)'
    }),
  config: Joi.object()
    .default({})
});

/**
 * Update provider schema (all fields optional)
 */
const updateProviderSchema = Joi.object({
  name: Joi.string()
    .lowercase()
    .pattern(/^[a-z0-9_-]+$/)
    .min(2)
    .max(50)
    .messages({
      'string.pattern.base': 'Provider name must contain only lowercase letters, numbers, hyphens, and underscores'
    }),
  displayName: Joi.string()
    .min(2)
    .max(100),
  apiBaseUrl: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .max(500),
  apiKey: Joi.string()
    .min(10)
    .max(500)
    .messages({
      'string.min': 'API key must be at least 10 characters'
    }),
  enabled: Joi.boolean(),
  priority: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .messages({
      'number.min': 'Priority must be at least 1 (lower = higher priority)',
      'number.max': 'Priority must not exceed 1000'
    }),
  rateLimit: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .messages({
      'number.min': 'Rate limit must be at least 1 request per minute'
    }),
  timeout: Joi.number()
    .integer()
    .min(1000)
    .max(60000)
    .messages({
      'number.min': 'Timeout must be at least 1000ms (1 second)',
      'number.max': 'Timeout must not exceed 60000ms (60 seconds)'
    }),
  config: Joi.object()
}).min(1); // At least one field must be provided

/**
 * Provider ID param schema
 */
const providerIdSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
});

/**
 * Provider name param schema
 */
const providerNameSchema = Joi.object({
  name: Joi.string()
    .lowercase()
    .pattern(/^[a-z0-9_-]+$/)
    .min(2)
    .max(50)
    .required()
});

/**
 * Update priority schema
 */
const updatePrioritySchema = Joi.object({
  priority: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .required()
    .messages({
      'number.min': 'Priority must be at least 1 (lower = higher priority)',
      'number.max': 'Priority must not exceed 1000'
    })
});

module.exports = {
  createProviderSchema,
  updateProviderSchema,
  providerIdSchema,
  providerNameSchema,
  updatePrioritySchema
};
