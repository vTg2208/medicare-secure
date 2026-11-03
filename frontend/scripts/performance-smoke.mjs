// Browser plugin not available in this session: regular Playwright fallback.
// Flow: production page -> delayed loading -> page/search -> current results.
// Uses synthetic intercepted API data only; never targets a hosted environment.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.PERFORMANCE_BASE_URL || 'http://127.0.0.1:4177';
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname), 'Performance fixtures are restricted to localhost');
const artifacts = path.resolve(root, '../.local/performance-browser');
fs.mkdirSync(artifacts, { recursive: true });
let server, browser;
try {
    if (!process.env.PERFORMANCE_BASE_URL) {
        server = spawn(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '4177', '--strictPort'], { cwd: root, stdio: 'ignore', windowsHide: true });
        for (let attempt = 0; ; attempt++) {
            try { if ((await fetch(base)).ok) break; } catch { /* Wait for the owned preview server. */ }
            if (attempt >= 60 || server.exitCode !== null) throw Error('Preview server failed to start');
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    browser = await chromium.launch({ headless: true, channel: process.env.PERFORMANCE_BROWSER_CHANNEL || undefined });
    const observations = [];
    for (const scenario of [
        { name: 'home-mobile-slow', route: '/', role: null, width: 390, slow: true },
        { name: 'users-desktop', route: '/admin/users', role: 'hospital_admin', width: 1280 },
        { name: 'records-mobile-slow', route: '/patient/medical-records', role: 'patient', width: 390, slow: true }
    ]) {
        const context = await browser.newContext({ viewport: { width: scenario.width, height: 844 }, reducedMotion: 'reduce' });
        if (scenario.role) await context.addInitScript(() => localStorage.setItem('healthcare_token', 'synthetic-browser-fixture'));
        const page = await context.newPage();
        const errors = [], requests = [], apiCalls = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        page.on('request', request => requests.push(request.url()));
        await page.route('**/api/**', async route => {
            const url = new URL(route.request().url());
            apiCalls.push(url);
            if (url.pathname.endsWith('/performance')) return route.fulfill({ status: 204 });
            if (url.pathname.endsWith('/auth/verify')) return route.fulfill({ json: { success: true, user: { id: 'patient', role: scenario.role, firstName: 'Fixture', email: 'fixture@example.invalid' } } });
            await new Promise(resolve => setTimeout(resolve, 700));
            const offset = Number(url.searchParams.get('offset') || 0);
            const search = url.searchParams.get('search');
            const rows = Array.from({ length: 65 }, (_, index) => ({ id: `row-${index}`, first_name: index === 64 ? 'Beyond' : `Person ${index}`, last_name: 'Fixture',
                email: `person${index}@example.invalid`, role: 'patient', is_active: true, created_at: '2026-01-01T12:00:00Z',
                title: index === 64 ? 'Older matching visit' : `Routine visit ${index}`, description: 'Synthetic summary', type: 'consultation', created_by_name: 'Dr Fixture' }));
            const matches = search ? rows.filter(row => `${row.first_name} ${row.title}`.toLowerCase().includes(search.toLowerCase())) : rows;
            const pagination = { total: matches.length, limit: 20, offset };
            if (url.pathname === '/api/users') return route.fulfill({ json: { success: true, data: matches.slice(offset,offset+20), pagination } });
            if (url.pathname.endsWith('/medical-records')) return route.fulfill({ json: { success: true, data: { records: matches.slice(offset,offset+20), pagination } } });
            throw Error(`Unexpected fixture request: ${url.pathname}`);
        });
        if (scenario.slow) {
            const cdp = await context.newCDPSession(page);
            await cdp.send('Network.enable');
            await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 200000, uploadThroughput: 75000 });
            await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        }
        const started = performance.now();
        await page.goto(base + scenario.route, { waitUntil: 'domcontentloaded' });
        assert.equal(new URL(page.url()).pathname, scenario.route);
        assert.match(await page.title(), /Medicare/i);
        if (!scenario.role) {
            await page.getByRole('heading', { level: 1 }).waitFor();
            assert.equal(await page.locator('img[loading="lazy"]').count(), 3);
            assert.equal(await page.locator('vite-error-overlay').count(), 0);
        } else {
            await page.getByRole('status').filter({ hasText: /Loading users|Loading medical records/ }).waitFor();
            await page.screenshot({ path: path.join(artifacts, `${scenario.name}-loading.png`) });
            const next = page.getByRole('button', { name: 'Next page' });
            await next.waitFor();
            await page.waitForFunction(() => !document.querySelector('button[aria-label="Next page"]').disabled);
            await next.click();
            await page.getByText('Page 2 of 4 · 65 results', { exact: true }).waitFor();
            await page.waitForFunction(() => !document.querySelector('button[aria-label="Next page"]').disabled);
            const search = page.getByRole('textbox', { name: scenario.role === 'patient' ? 'Search medical records' : 'Search users' });
            await search.fill(scenario.role === 'patient' ? 'Old' : 'Be');
            await search.fill(scenario.role === 'patient' ? 'Older' : 'Beyond');
            await page.getByText('Page 1 of 1 · 1 results', { exact: true }).waitFor();
            assert.equal(apiCalls.filter(url => url.searchParams.has('search')).length, 1);
        }
        await page.evaluate(() => document.fonts.ready);
        assert.ok(await page.evaluate(() => document.fonts.check('400 16px "Plus Jakarta Sans"')));
        // Unused icon fonts should stay unloaded on the SVG-only homepage.
        if (await page.locator('.material-symbols-outlined').count()) {
            assert.ok(await page.evaluate(() => document.fonts.check('400 24px "Material Symbols Outlined"')));
        }
        assert.equal(await page.locator('vite-error-overlay').count(), 0);
        assert.deepEqual(errors, []);
        assert.deepEqual(requests.filter(url => /^https?:/.test(url) && new URL(url).origin !== new URL(base).origin), []);
        await page.screenshot({ path: path.join(artifacts, `${scenario.name}-ready.png`) });
        observations.push({ scenario: scenario.name, elapsedMs: Math.round(performance.now()-started), slowNetwork: Boolean(scenario.slow), apiRequests: apiCalls.length, errors });
        await context.close();
    }
    fs.writeFileSync(path.join(artifacts, 'results.json'), JSON.stringify(observations,null,2));
    process.stdout.write(JSON.stringify({ passed: observations.length, observations, artifacts }, null, 2) + '\n');
} finally {
    if (browser) await browser.close();
    if (server) { server.kill(); await new Promise(resolve => server.once('exit',resolve)); }
}
