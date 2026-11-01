const winston = require('winston');
const path = require('path');
const { sanitizeMessage, sanitizeMetadata, sanitizeLogRecord } = require('./log-sanitizer');
const { getRequestContext } = require('../services/request-context');

const levels = { error:0, warn:1, info:2, http:3, debug:4 };
const sanitized = winston.format(info => sanitizeLogRecord(info));
const json = () => winston.format.combine(sanitized(),winston.format.json());
const file = (name,options={}) => new winston.transports.File({
    filename:path.join('logs',name),maxsize:10*1024*1024,maxFiles:5,format:json(),...options,
});

const logger = winston.createLogger({
    level:process.env.NODE_ENV==='development'?'debug':'info',
    levels,
    format:winston.format.combine(sanitized(),winston.format.timestamp({format:'YYYY-MM-DD HH:mm:ss'}),winston.format.json()),
    transports:[
        new winston.transports.Console({format:winston.format.combine(sanitized(),winston.format.printf(info=>{
            const {timestamp,level,message,...metadata}=info;
            const details=Object.keys(metadata).length?` ${JSON.stringify(metadata)}`:'';
            return `${timestamp} ${level}: ${message}${details}`;
        }))}),
        file('error.log',{level:'error'}),
        file('combined.log'),
    ],
    exceptionHandlers:[file('exceptions.log')],
    rejectionHandlers:[file('rejections.log')],
});

// Sanitize before Winston merges Error.message into its primary message. The
// final formats separately protect direct logger.log and fatal-handler events.
for(const level of Object.keys(levels)) {
    const original=logger[level].bind(logger);
    logger[level]=(message,...metadata)=>{
        const safe=Object.assign({},sanitizeMetadata(message),...metadata.slice(0,4).map(value=>sanitizeMetadata(value)));
        const requestId=getRequestContext()?.requestId;
        if(requestId) Object.assign(safe,sanitizeMetadata({requestId}));
        const primary=message&&typeof message==='object'?sanitizeLogRecord(message).message:sanitizeMessage(message);
        return original(primary,safe);
    };
}

module.exports=logger;
