const express = require('express');
const domainController = require('../controllers/domainController');
const { authenticate } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const {
  createDomainSchema,
  bulkCreateDomainsSchema,
  bulkRetrieveSchema,
  bulkStatusSchema,
  listDomainsQuerySchema,
  domainIdParamSchema
} = require('../validators/domainSchemas');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Single domain operations
router.post('/', validate(createDomainSchema), domainController.create);
router.get('/', validate(listDomainsQuerySchema, 'query'), domainController.list);
router.get('/:id', validate(domainIdParamSchema, 'params'), domainController.getById);
router.get('/:id/details', validate(domainIdParamSchema, 'params'), domainController.getDetails);
router.get('/:id/history', validate(domainIdParamSchema, 'params'), domainController.getHistory);
router.patch('/:id/stop', validate(domainIdParamSchema, 'params'), domainController.stop);
router.patch('/:id/start', validate(domainIdParamSchema, 'params'), domainController.start);

// Bulk operations
router.post('/bulk', validate(bulkCreateDomainsSchema), domainController.bulkCreate);
router.post('/bulk/retrieve', validate(bulkRetrieveSchema), domainController.bulkRetrieve);
router.patch('/bulk/stop', validate(bulkStatusSchema), domainController.bulkStop);
router.patch('/bulk/start', validate(bulkStatusSchema), domainController.bulkStart);

module.exports = router;
