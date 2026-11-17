const crypto = require('node:crypto');
const sha256 = value => crypto.createHash('sha256').update(value).digest();
function authenticator() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const jwk = publicKey.export({ format: 'jwk' });
    const credentialId = crypto.randomBytes(32).toString('base64url');
    // Canonical CBOR COSE EC2/P-256/ES256 public key.
    const cose = Buffer.concat([Buffer.from('a5010203262001215820', 'hex'), Buffer.from(jwk.x, 'base64url'),
        Buffer.from('225820', 'hex'), Buffer.from(jwk.y, 'base64url')]);
    const assertion = (challenge, { verified = true, origin = 'http://localhost:3000', counter = 1 } = {}) => {
        const count = Buffer.alloc(4); count.writeUInt32BE(counter);
        const data = Buffer.concat([sha256('localhost'), Buffer.from([verified ? 5 : 1]), count]);
        const client = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge, origin, crossOrigin: false }));
        const signature = crypto.sign('sha256', Buffer.concat([data, sha256(client)]), privateKey);
        return { id: credentialId, rawId: credentialId, type: 'public-key', clientExtensionResults: {},
            response: { authenticatorData: data.toString('base64url'), clientDataJSON: client.toString('base64url'), signature: signature.toString('base64url') } };
    };
    return { credentialId, cose, assertion };
}
module.exports = { authenticator };
