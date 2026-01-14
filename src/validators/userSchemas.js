const Joi = require('joi');

const updateProfileSchema = Joi.object({
  name: Joi.string()
    .max(255)
    .optional(),

  email: Joi.string()
    .email()
    .max(255)
    .optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

module.exports = {
  updateProfileSchema
};
