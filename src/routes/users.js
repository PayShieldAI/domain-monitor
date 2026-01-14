const express = require('express');
const userController = require('../controllers/userController');
const { authenticate } = require('../middlewares/auth');
const validate = require('../middlewares/validate');
const { updateProfileSchema } = require('../validators/userSchemas');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

router.get('/me', userController.getProfile);
router.patch('/me', validate(updateProfileSchema), userController.updateProfile);

module.exports = router;
