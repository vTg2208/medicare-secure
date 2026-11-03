const pagination = (options = {}) => {
    const bounded = (value, fallback, min, max) => {
        const number = Number(value);
        return value !== undefined && value !== '' && Number.isSafeInteger(number) ? Math.max(min, Math.min(max, number)) : fallback;
    };
    return { limit: bounded(options.limit, 50, 1, 100), offset: bounded(options.offset, 0, 0, 1000000) };
};
const searchPattern = value => typeof value === 'string' && value.trim()
    ? `%${value.trim().slice(0,120).replace(/[\\%_]/g, '\\$&')}%` : null;
module.exports = { pagination, searchPattern };
