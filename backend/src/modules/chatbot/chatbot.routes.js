const express = require('express');
const router = express.Router();
const controller = require('./chatbot.controller');
const { authenticate, authorize } = require('../../middleware/auth.middleware');
router.use(authenticate);
router.use(async (req,res,next) => {
    if (req.method !== 'POST') return next();
    try {
        const { processingAllowedSql } = require('../privacy/processing-policy');
        const result = await require('../../config/db').query(`SELECT ${processingAllowedSql('$1::uuid','ai')} AS allowed`,[req.user.id]);
        if (result.rows[0]?.allowed !== true) return res.status(403).json({success:false,message:'AI processing is restricted for this patient'});
        return next();
    } catch(error) { return next(error); }
});
router.post('/start', authorize('patient'), controller.startSession);
router.post('/message', authorize('patient'), controller.sendMessage);
router.post('/analyze', authorize('patient'), controller.analyzeSession);
router.get('/summary/:id', authorize(['patient', 'doctor']), controller.getSummary);
router.get('/sessions', authorize('doctor'), controller.getAllSessions);
module.exports = router;
