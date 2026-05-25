const express = require('express');
const router = express.Router();
const memberController = require('../controllers/member.controller');
const { authenticate, authorize } = require('../middleware/auth.middleware');

// PUBLIC routes — must come before router.use(authenticate)
router.get('/links/:token',       memberController.validateLink);
router.post('/register/:token',   memberController.registerMember);

router.use(authenticate);

// Registration link management (admin only)
router.post('/links',             authorize(['ADMIN']), memberController.createLink);
router.get('/links',              authorize(['ADMIN']), memberController.listLinks);
router.delete('/links/:id',       authorize(['ADMIN']), memberController.deactivateLink);

// Member CRUD
router.get('/', memberController.getMembers);
router.get('/stats', memberController.getMemberStats);
router.get('/pending-de', authorize(['ADMIN']), memberController.listPendingDE);
router.get('/:id', memberController.getMemberById);
router.post('/', authorize(['ADMIN']), memberController.createMember);
router.put('/:id', authorize(['ADMIN']), memberController.updateMember);
router.delete('/:id', authorize(['ADMIN']), memberController.deleteMember);
router.patch('/:id/restore', authorize(['ADMIN']), memberController.restoreMember);
router.post('/:id/dues', authorize(['ADMIN']), memberController.recordDues);
router.post('/:id/send-vote-code', authorize(['ADMIN']), memberController.sendVoteCode);
router.post('/bulk-import', authorize(['ADMIN']), memberController.bulkImport);
router.patch('/:id/approve', authorize(['ADMIN']), memberController.approveMember);
router.delete('/:id/reject', authorize(['ADMIN']), memberController.rejectMember);

module.exports = router;
