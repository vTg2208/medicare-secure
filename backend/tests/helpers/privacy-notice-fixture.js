const noticeFixture = (title = 'Synthetic healthcare privacy notice') => ({
    title, operatorName: 'Fixture Healthcare Platform', contactEmail: 'privacy@example.invalid',
    sections: {
        purposes: 'Provide authorized care and operate the synthetic healthcare account workflows.',
        processingBasis: 'The responsible organization reviews the applicable basis; this fixture establishes no legal conclusion.',
        dataCategories: 'Patient profiles, care records, reports, consent and accountability information are processed.',
        recipients: 'Authorized care staff and reviewed infrastructure providers receive only scoped information.',
        retention: 'Reviewed category policies, active care and legal holds determine the supported disposal decisions.',
        transfers: 'Not applicable to this offline fixture; actual provider locations and transfers require review.',
        rights: 'Use the authenticated Privacy Center for information requests, controls, corrections and owned exports.',
        complaints: 'Contact the responsible privacy officer through the reviewed organization complaint procedure.',
        security: 'Selected narratives and files are encrypted; provider storage and key custody need separate assurance.',
    },
    reviewBasis: 'Synthetic owner-reviewed publication fixture; this private review explanation is not public notice text.',
});
module.exports = { noticeFixture };
