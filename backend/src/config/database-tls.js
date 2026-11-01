// Public trust material only. Missing configured CA files fail startup closed.
const {readFileSync}=require('node:fs');
function databaseTls(env=process.env) {
    if(env.DB_SSL!=='true')return false;
    const ca=env.DB_SSL_CA_FILE?readFileSync(env.DB_SSL_CA_FILE,'utf8'):env.DB_SSL_CA?.replace(/\\n/g,'\n');
    return {rejectUnauthorized:true,minVersion:'TLSv1.2',...(ca?{ca}:{})};
}
module.exports={databaseTls};
