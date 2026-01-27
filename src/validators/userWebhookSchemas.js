const Joi = require('joi');

const validEvents = [
  'domain.created',
  'business-profile',
  'domain.deleted',
  'business-closed',
  'sentiment',
  'website'
];

const createWebhookEndpointSchema = Joi.object({
  userId: Joi.string()
    .uuid()
    .optional()
    .messages({
      'string.guid': 'Invalid user ID format - must be a valid UUID'
    })
    .description('User ID - required when using API key authentication. Superadmins, resellers, and API keys can specify this to create webhooks for other users.'),

  url: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .max(2048)
    .required()
    .messages({
      'string.uri': 'Please provide a valid HTTP or HTTPS URL',
      'any.required': 'URL is required'
    }),

  events: Joi.array()
    .items(Joi.string().valid(...validEvents))
    .min(1)
    .optional()
    .allow(null)
    .default(null)
    .messages({
      'array.min': 'At least one event type is required when events array is provided',
      'any.only': `Event must be one of: ${validEvents.join(', ')}`
    })
    .description('Event types to subscribe to. Leave empty or null to subscribe to all events'),

  description: Joi.string()
    .max(500)
    .optional()
    .allow(null, '')
    .messages({
      'string.max': 'Description must not exceed 500 characters'
    })
});

const updateWebhookEndpointSchema = Joi.object({
  url: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .max(2048)
    .optional()
    .messages({
      'string.uri': 'Please provide a valid HTTP or HTTPS URL'
    }),

  events: Joi.array()
    .items(Joi.string().valid(...validEvents))
    .min(1)
    .optional()
    .allow(null)
    .messages({
      'array.min': 'At least one event type is required when events array is provided',
      'any.only': `Event must be one of: ${validEvents.join(', ')}`
    })
    .description('Event types to subscribe to. Set to null to subscribe to all events'),

  description: Joi.string()
    .max(500)
    .optional()
    .allow(null, '')
    .messages({
      'string.max': 'Description must not exceed 500 characters'
    }),

  enabled: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'Enabled must be a boolean value'
    })
});

const webhookEndpointIdSchema = Joi.object({
  id: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'Invalid webhook endpoint ID format',
      'any.required': 'Webhook endpoint ID is required'
    })
});

module.exports = {
  createWebhookEndpointSchema,
  updateWebhookEndpointSchema,
  webhookEndpointIdSchema
};
