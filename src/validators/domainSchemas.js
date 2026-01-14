const Joi = require('joi');

const domainPattern = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

const createDomainSchema = Joi.object({
  domain: Joi.string()
    .pattern(domainPattern)
    .max(255)
    .required()
    .messages({
      'string.pattern.base': 'Please provide a valid domain name',
      'any.required': 'Domain is required'
    }),

  checkFrequency: Joi.string()
    .valid('daily', 'weekly', 'monthly')
    .default('daily')
});

const bulkCreateDomainsSchema = Joi.object({
  domains: Joi.array()
    .items(
      Joi.object({
        domain: Joi.string()
          .pattern(domainPattern)
          .max(255)
          .required(),
        checkFrequency: Joi.string()
          .valid('daily', 'weekly', 'monthly')
          .default('daily')
      })
    )
    .min(1)
    .max(100)
    .required()
    .messages({
      'array.min': 'At least one domain is required',
      'array.max': 'Maximum 100 domains per request'
    })
});

const bulkRetrieveSchema = Joi.object({
  ids: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .max(100)
    .required()
    .messages({
      'array.min': 'At least one ID is required',
      'array.max': 'Maximum 100 IDs per request'
    })
});

const bulkStatusSchema = Joi.object({
  ids: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .max(100)
    .required()
    .messages({
      'array.min': 'At least one ID is required',
      'array.max': 'Maximum 100 IDs per request'
    })
});

const listDomainsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid('active', 'inactive'),
  recommendation: Joi.string().valid('pass', 'fail', 'review'),
  search: Joi.string().max(255),
  sortBy: Joi.string().valid('created_at', 'updated_at', 'domain', 'name', 'recommendation', 'last_checked_at').default('created_at'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
});

const domainIdParamSchema = Joi.object({
  id: Joi.string().uuid().required()
});

module.exports = {
  createDomainSchema,
  bulkCreateDomainsSchema,
  bulkRetrieveSchema,
  bulkStatusSchema,
  listDomainsQuerySchema,
  domainIdParamSchema
};
