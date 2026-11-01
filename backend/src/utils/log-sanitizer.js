const LEVEL = Symbol.for('level');
const levels = new Set(['error','warn','info','http','debug']);
const numberFields = ['count','total','rows','duration','durationMs','port','attempts','statusCode','legacyLogs','totalLogs','failedCount'];
const idFields = ['requestId','correlationId'];
const codeFields = ['code','errorCode'];
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
const safeCode = value => typeof value==='string' && /^(?:[A-Z][A-Z0-9_]{0,31}|[A-Z0-9]{5})$/.test(value);
const own = (object,key) => object && Object.getOwnPropertyDescriptor(object,key)?.value;

const sanitizeMessage = message => {
    if(typeof message!=='string') return message instanceof Error ? 'Application error' : 'Application event';
    return message.slice(0,512)
        .replace(/https?:\/\/[^\s]+/gi,'[URL]')
        .replace(/(\/(?:invitations|password-reset|reset-password|otp|token)\/)[^/?\s]+/gi,'$1[REDACTED]')
        .replace(/[^\s<>@"']+@[^\s<>@"']+/g,'[REDACTED]')
        .replace(/[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}/gi,'[ID]')
        .replace(/\bBearer\s+[^\s]+/gi,'Bearer [REDACTED]')
        .replace(/[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,'[REDACTED]')
        .replace(/\+?\d[\d(). -]{5,}\d/g,'[REDACTED]')
        .replace(/\b(password|secret|token|otp|authorization|cookie|diagnosis|symptoms?|clinical|notes?)\s*[:=].*$/gi,'$1=[REDACTED]')
        .replace(/[\u0000-\u001f\u007f]/g,' ');
};

const errorMetadata = value => {
    const code=own(value,'code');
    return { errorType: value instanceof TypeError ? 'TypeError' : value instanceof RangeError ? 'RangeError' : value instanceof SyntaxError ? 'SyntaxError' : 'Error',
        ...(safeCode(code)&&{errorCode:code}) };
};

const sanitizeMetadata = (value,depth=0) => {
    if(!value || typeof value!=='object' || depth>3) return {};
    if(value instanceof Error) return errorMetadata(value);
    const safe={};
    for(const key of numberFields) {
        const item=own(value,key);
        if(typeof item==='number' && Number.isFinite(item) && item>=0) safe[key]=item;
    }
    for(const key of idFields) { const item=own(value,key); if(typeof item==='string'&&uuid.test(item)) safe[key]=item; }
    for(const key of codeFields) { const item=own(value,key); if(safeCode(item)) safe[key]=item; }
    const error=own(value,'error');
    if(error instanceof Error) Object.assign(safe,errorMetadata(error));
    const type=own(value,'errorType');
    if(['Error','TypeError','RangeError','SyntaxError'].includes(type)) safe.errorType=type;
    for(const key of ['context','counts','metrics']) {
        const item=sanitizeMetadata(own(value,key),depth+1);
        if(Object.keys(item).length) safe[key]=item;
    }
    return safe;
};

const sanitizeLogRecord = info => {
    const fatal=own(info,'exception') || own(info,'rejection');
    const rawError=info instanceof Error || own(info,'stack') || own(info,'error') || own(info,'message') instanceof Error;
    const message=fatal ? (own(info,'rejection') ? 'Unhandled application rejection' : 'Unhandled application exception')
        : rawError ? 'Application error' : sanitizeMessage(own(info,'message'));
    const level=levels.has(own(info,'level')) ? own(info,'level') : 'info';
    const safe={level,message,...sanitizeMetadata(info),[LEVEL]:level};
    // Winston's dedicated fatal streams require these boolean routing markers.
    if(own(info,'exception')===true) safe.exception=true;
    if(own(info,'rejection')===true) safe.rejection=true;
    const timestamp=own(info,'timestamp');
    if(typeof timestamp==='string'&&/^[\dTZ:.+\- ]{10,35}$/.test(timestamp)) safe.timestamp=timestamp;
    return safe;
};

module.exports={sanitizeMessage,sanitizeMetadata,sanitizeLogRecord};
