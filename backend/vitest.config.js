const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
    test: {
        environment: 'node',
        clearMocks: true,
        restoreMocks: true,
        globals: true,
        include: ['tests/unit/**/*.test.js'],
    },
});
