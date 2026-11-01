const { encryptBuffer, decryptBuffer } = require('../../services/file.crypto');

const requireContext = context => {
    if (typeof context !== 'string' || !context.trim()) throw new Error('Privacy encryption context is required');
    return context;
};
const seal = (value, context) => encryptBuffer(Buffer.from(JSON.stringify(value), 'utf8'), requireContext(context)).toString('base64');
const unseal = (value, context) => JSON.parse(decryptBuffer(Buffer.from(value, 'base64'), requireContext(context)).toString('utf8'));
module.exports = { seal, unseal };
