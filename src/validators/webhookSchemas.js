const Joi = require('joi');

const listWebhooksQuerySchema = Joi.object({
  // Filter by provider
  provider: Joi.string()
    .max(50)
    .messages({
      'string.max': 'Provider name must be 50 characters or less'
    }),

  // Filter by domain ID
  domainId: Joi.string()
    .uuid()
    .messages({
      'string.guid': 'Please provide a valid domain ID'
    }),

  // Filter by processing status
  status: Joi.boolean()
    .messages({
      'boolean.base': 'Status must be true or false'
    }),

  // Date range filters (ISO 8601 format)
  dateFrom: Joi.date()
    .iso()
    .messages({
      'date.format': 'Date from must be in ISO 8601 format',
      'date.base': 'Invalid date from format'
    }),

  dateTo: Joi.date()
    .iso()
    .min(Joi.ref('dateFrom'))
    .messages({
      'date.format': 'Date to must be in ISO 8601 format',
      'date.base': 'Invalid date to format',
      'date.min': 'Date to must be after date from'
    }),

  // Pagination
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(20)
    .messages({
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    }),

  offset: Joi.number()
    .integer()
    .min(0)
    .default(0)
    .messages({
      'number.min': 'Offset must be 0 or greater'
    }),

  // Alternative pagination with page number
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .messages({
      'number.min': 'Page must be at least 1'
    })
});

module.exports = {
  listWebhooksQuerySchema
};
