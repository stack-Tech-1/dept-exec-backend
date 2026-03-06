const express = require('express');
const router = express.Router();
const memberController = require('../controllers/member.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

router.use(authenticate);

router.get('/', memberController.getMembers);
router.get('/stats', memberController.getMemberStats);
router.get('/:id', memberController.getMemberById);
router.post('/', authorize(['ADMIN']), memberController.createMember);
router.put('/:id', authorize(['ADMIN']), memberController.updateMember);
router.delete('/:id', authorize(['ADMIN']), memberController.deleteMember);
router.post('/:id/dues', authorize(['ADMIN']), memberController.recordDues);
router.post('/bulk-import', authorize(['ADMIN']), memberController.bulkImport);

module.exports = router;
