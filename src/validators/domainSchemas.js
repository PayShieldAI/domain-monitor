const Joi = require('joi');

const domainPattern = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

const createDomainSchema = Joi.object({
  // Primary identifiers (at least one required)
  domain: Joi.string()
    .pattern(domainPattern)
    .max(255)
    .messages({
      'string.pattern.base': 'Please provide a valid domain name'
    }),

  name: Joi.string()
    .max(255)
    .messages({
      'string.max': 'Business name must be 255 characters or less'
    }),

  // Business details
  description: Joi.string()
    .max(1000),

  website: Joi.string()
    .uri()
    .max(500)
    .messages({
      'string.uri': 'Please provide a valid website URL'
    }),

  // Address fields
  addressLine1: Joi.string().max(255),
  addressLine2: Joi.string().max(255),
  city: Joi.string().max(100),
  stateProvince: Joi.string().max(100),
  postalCode: Joi.string().max(20),
  country: Joi.string().max(100),

  // Contact info
  email: Joi.string().email().max(255),
  phone: Joi.string().max(50),
  fullName: Joi.string().max(255),

  // Tracking
  externalTrackingRef: Joi.string().max(255),

  // Check settings - if not provided, no monitoring will be started (one-time check only)
  checkFrequency: Joi.string()
    .valid('7', '30', '90')
    .optional()
    .allow(null)
    .messages({
      'any.only': 'Check frequency must be 7, 30, or 90 days'
    }),

  // Admin use
  merchantId: Joi.string()
    .uuid()
    .messages({
      'string.guid': 'Please provide a valid merchant ID'
    })
}).or('domain', 'name').messages({
  'object.missing': 'Either domain or business name is required'
});

const bulkDomainItemSchema = Joi.object({
  // Primary identifiers (at least one required)
  domain: Joi.string()
    .pattern(domainPattern)
    .max(255),
  name: Joi.string()
    .max(255),

  // Business details
  description: Joi.string().max(1000),
  website: Joi.string().uri().max(500),

  // Address fields
  addressLine1: Joi.string().max(255),
  addressLine2: Joi.string().max(255),
  city: Joi.string().max(100),
  stateProvince: Joi.string().max(100),
  postalCode: Joi.string().max(20),
  country: Joi.string().max(100),

  // Contact info
  email: Joi.string().email().max(255),
  phone: Joi.string().max(50),
  fullName: Joi.string().max(255),

  // Tracking
  externalTrackingRef: Joi.string().max(255),

  // Check settings - if not provided, no monitoring will be started (one-time check only)
  checkFrequency: Joi.string()
    .valid('7', '30', '90')
    .optional()
    .allow(null)
    .messages({
      'any.only': 'Check frequency must be 7, 30, or 90 days'
    })
}).or('domain', 'name').messages({
  'object.missing': 'Either domain or business name is required'
});

const bulkCreateDomainsSchema = Joi.object({
  domains: Joi.array()
    .items(bulkDomainItemSchema)
    .min(1)
    .max(100)
    .required()
    .messages({
      'array.min': 'At least one domain is required',
      'array.max': 'Maximum 100 domains per request'
    }),

  merchantId: Joi.string()
    .uuid()
    .messages({
      'string.guid': 'Please provide a valid merchant ID'
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
