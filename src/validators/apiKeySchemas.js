const Joi = require('joi');

const createApiKeySchema = Joi.object({
  name: Joi.string()
    .min(3)
    .max(255)
    .required()
    .messages({
      'string.min': 'Name must be at least 3 characters',
      'string.max': 'Name must not exceed 255 characters',
      'any.required': 'Name is required'
    }),

  description: Joi.string()
    .max(1000)
    .optional()
    .allow(null, '')
    .messages({
      'string.max': 'Description must not exceed 1000 characters'
    }),

  permissions: Joi.array()
    .items(Joi.string())
    .optional()
    .default([])
    .messages({
      'array.base': 'Permissions must be an array of strings'
    }),

  expiresAt: Joi.date()
    .iso()
    .greater('now')
    .optional()
    .allow(null)
    .messages({
      'date.base': 'Expires at must be a valid date',
      'date.greater': 'Expiration date must be in the future'
    })
});

const updateApiKeySchema = Joi.object({
  name: Joi.string()
    .min(3)
    .max(255)
    .optional()
    .messages({
      'string.min': 'Name must be at least 3 characters',
      'string.max': 'Name must not exceed 255 characters'
    }),

  description: Joi.string()
    .max(1000)
    .optional()
    .allow(null, '')
    .messages({
      'string.max': 'Description must not exceed 1000 characters'
    }),

  permissions: Joi.array()
    .items(Joi.string())
    .optional()
    .messages({
      'array.base': 'Permissions must be an array of strings'
    }),

  expiresAt: Joi.date()
    .iso()
    .greater('now')
    .optional()
    .allow(null)
    .messages({
      'date.base': 'Expires at must be a valid date',
      'date.greater': 'Expiration date must be in the future'
    })
});

const apiKeyIdSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid API key ID format',
      'any.required': 'API key ID is required'
    })
});

module.exports = {
  createApiKeySchema,
  updateApiKeySchema,
  apiKeyIdSchema
};
