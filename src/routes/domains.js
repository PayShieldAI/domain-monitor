const express = require('express');
const domainController = require('../controllers/domainController');
const { authenticateFlexible } = require('../middlewares/auth');
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

// All routes require authentication (JWT or API key)
router.use(authenticateFlexible);

// Single domain operations
router.post('/', validate(createDomainSchema), domainController.create);
router.get('/', validate(listDomainsQuerySchema, 'query'), domainController.list);

// Bulk operations
router.post('/bulk', validate(bulkCreateDomainsSchema), domainController.bulkCreate);
router.post('/bulk/retrieve', validate(bulkRetrieveSchema), domainController.bulkRetrieve);
router.patch('/bulk/stop', validate(bulkStatusSchema), domainController.bulkStop);
router.patch('/bulk/start', validate(bulkStatusSchema), domainController.bulkStart);

router.get('/:id', validate(domainIdParamSchema, 'params'), domainController.getById);
router.get('/:id/details', validate(domainIdParamSchema, 'params'), domainController.getDetails);
router.post('/:id/check', validate(domainIdParamSchema, 'params'), domainController.recheckDomain);
router.patch('/:id/stop', validate(domainIdParamSchema, 'params'), domainController.stop);
router.patch('/:id/start', validate(domainIdParamSchema, 'params'), domainController.start);

module.exports = router;
