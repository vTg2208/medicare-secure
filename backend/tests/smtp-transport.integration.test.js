const {test}=require('node:test');const assert=require('node:assert/strict');const net=require('node:net');
test('production mail refuses a relay without TLS before sending credentials or message data',async()=>{
    const commands=[];const sockets=new Set();
    const server=net.createServer(socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.setEncoding('utf8');socket.write('220 fixture.invalid SMTP\r\n');
        let buffer='';socket.on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\r\n'))!==-1){const line=buffer.slice(0,end);buffer=buffer.slice(end+2);commands.push(line.split(' ')[0]);if(/^EHLO|^HELO/.test(line))socket.write('250 fixture.invalid\r\n');else if(/^STARTTLS/.test(line))socket.write('502 TLS unavailable\r\n');else socket.write('500 Unsupported\r\n');}});
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const nodemailer=require('nodemailer');const create=nodemailer.createTransport;
    const previous={...process.env};
    nodemailer.createTransport=options=>{const transport=create.call(nodemailer,options);transport.verify=()=>{};return transport;};
    process.env.NODE_ENV='production';process.env.EMAIL_HOST='127.0.0.1';process.env.EMAIL_PORT=String(server.address().port);process.env.EMAIL_SECURE='false';process.env.EMAIL_FROM='fixture@example.invalid';process.env.EMAIL_USER='synthetic-user';process.env.EMAIL_PASSWORD='synthetic-password';
    try {
        const mail=require('../src/config/mail');
        await assert.rejects(mail.sendEmail({to:'fixture@example.invalid',subject:'Synthetic fixture',text:'Synthetic private body'}),error=>error.code==='ETLS');
        assert.ok(commands.includes('STARTTLS'));assert.ok(!commands.some(command=>['AUTH','MAIL','RCPT','DATA'].includes(command)));
    }finally{nodemailer.createTransport=create;for(const key of Object.keys(process.env)){if(!(key in previous))delete process.env[key];}Object.assign(process.env,previous);for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));}
});
