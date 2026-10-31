const net = require('net');
// ClamAV INSTREAM: scans private files without publishing them to a third-party API.
async function scanBuffer(buffer) {
    const host = process.env.CLAMAV_HOST;
    if (!host) {
        if (process.env.NODE_ENV === 'production') throw Object.assign(new Error('File scanning service is not configured'), { statusCode: 503 });
        return;
    }
    return new Promise((resolve, reject) => {
        const socket = net.createConnection({ host, port: Number(process.env.CLAMAV_PORT || 3310) });
        let response = '';
        const fail = () => { socket.destroy(); reject(Object.assign(new Error('File scanning service is unavailable'), { statusCode: 503 })); };
        socket.setTimeout(15000, fail);
        socket.on('error', fail);
        socket.on('connect', () => {
            socket.write(Buffer.from('zINSTREAM\0'));
            for (let offset = 0; offset < buffer.length; offset += 65536) {
                const chunk = buffer.subarray(offset, offset + 65536);
                const size = Buffer.alloc(4); size.writeUInt32BE(chunk.length);
                socket.write(size); socket.write(chunk);
            }
            socket.write(Buffer.alloc(4));
        });
        socket.on('data', chunk => {
            response += chunk.toString('utf8');
            if (response.length > 1024) return fail();
            if (!response.includes('\0')) return;
            socket.destroy();
            if (/stream: OK\0/.test(response)) resolve();
            else reject(Object.assign(new Error('File rejected by the security scanner'), { statusCode: 400 }));
        });
        socket.on('end', () => { if (!response.includes('\0')) fail(); });
    });
}
module.exports = { scanBuffer };
