const { AsyncLocalStorage } = require('node:async_hooks');
const { randomUUID } = require('node:crypto');

const storage = new AsyncLocalStorage();
const getRequestContext = () => storage.getStore();
const runWithRequestContext = (context, callback) => storage.run(context, callback);
const requestContext = (req, res, next) => {
    const context = { requestId: randomUUID(), actorId: null, method: req.method };
    req.requestId = context.requestId;
    res.set('X-Request-Id', context.requestId);
    storage.run(context, next);
};
const bindAuthenticatedActor = (userId) => {
    const context = storage.getStore();
    if (context) context.actorId = userId;
};

module.exports = { getRequestContext, runWithRequestContext, requestContext, bindAuthenticatedActor };
