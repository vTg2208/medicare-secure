import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import postcss from 'postcss';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'src');
const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
const cssFiles = files(source).filter(file => file.endsWith('.css'));
const tokens = fs.readFileSync(path.join(source, 'styles/tokens.css'), 'utf8');
const declared = new Set([...tokens.matchAll(/(--mc-[\w-]+)\s*:/g)].map(match => match[1]));
const issues = [];
const label = (file) => path.relative(root, file).replaceAll('\\', '/');
const fail = (file, line, message) => issues.push(`${label(file)}:${line}: ${message}`);
const paper = (node) => {
    for (let parent = node.parent; parent; parent = parent.parent) {
        if (parent.type === 'atrule' && parent.name === 'media' && /\bprint\b/.test(parent.params)) return true;
        if (parent.type === 'rule' && parent.selector.includes('.mc-print-record')) return true;
    }
    return false;
};

for (const file of cssFiles) {
    const text = fs.readFileSync(file, 'utf8');
    const stylesheet = postcss.parse(text, { from: file });
    stylesheet.walkDecls(decl => {
        const line = decl.source.start.line;
        for (const [, token] of decl.value.matchAll(/var\((--mc-[\w-]+)/g)) if (!declared.has(token)) fail(file, line, `Undefined theme token ${token}`);
        if (file.endsWith('tokens.css') || paper(decl)) return;
        if (/#[\da-f]{3,8}\b|\brgba?\(/i.test(decl.value)) fail(file, line, 'Use semantic theme tokens for colors');
        if (/(?:linear|radial)-gradient\(/.test(decl.value)) fail(file, line, 'Use solid Medicare surfaces');
        if (decl.prop === 'font-family') {
            const careAccent = file.endsWith('global.css') && decl.parent.selector === '.mc-care-accent' && decl.value === 'var(--mc-font-care)';
            if (!careAccent && !/^(?:var\(--mc-font\)|inherit)$/.test(decl.value)) fail(file, line, 'Use the shared Medicare font');
        }
        if (/backdrop-filter/.test(decl.prop) && decl.value !== 'none') fail(file, line, 'Glass effects do not belong to the shared theme');
    });
}

const jsxFiles = files(source).filter(file => file.endsWith('.jsx') && !file.endsWith('.test.jsx'));
for (const file of jsxFiles) {
    const text = fs.readFileSync(file, 'utf8');
    text.split('\n').forEach((line, index) => {
        for (const [, token] of line.matchAll(/var\((--mc-[\w-]+)/g)) if (!declared.has(token)) fail(file, index + 1, `Undefined theme token ${token}`);
        if (/bg-gradient-to-|(?:linear|radial)-gradient\(|bg-clip-text|\bblur-/.test(line)) fail(file, index + 1, 'Remove decorative gradients and glow');
        if (/font-\[/.test(line)) fail(file, index + 1, 'Use the shared font rather than a page-specific font family');
        if (/import .*ParticleBackground/.test(line)) fail(file, index + 1, 'Use the shared calm page background');
        if (/(?:background(?:Color)?|border(?:Color|LeftColor)?|color|stroke|fill)\s*[:=]\s*['"][^'"]*(?:#[\da-f]{3,8}\b|\brgba?\()/i.test(line)) {
            // The PDF capture background and QR-code contrast are document/scanner data.
            const pdfPaper = file.endsWith('MedicalRecords.jsx') && /backgroundColor:\s*'#ffffff'/.test(line);
            const qr = file.endsWith('ReceptionistVisitManagement.jsx') && /(?:fgColor|bgColor)=/.test(line);
            if (!pdfPaper && !qr) fail(file, index + 1, 'Use semantic tokens for inline interface colors');
        }
    });
}

const config = createRequire(import.meta.url)(path.join(root, 'tailwind.config.js'));
const colors = config.theme.extend.colors;
for (const alias of ['secondary', 'indigo', 'violet', 'purple', 'blue', 'sky', 'cyan', 'teal']) {
    if (JSON.stringify(colors[alias]) !== JSON.stringify(colors.primary)) issues.push(`Tailwind ${alias} palette has drifted from Medicare primary`);
}
const tokenRoot = postcss.parse(tokens).nodes.find(node => node.type === 'rule' && node.selector === ':root');
const brand = tokenRoot.nodes.find(node => node.prop === '--mc-brand').value;
if (colors.primary[600] !== brand) issues.push('Tailwind primary action and CSS brand token must match');

const luminance = (hex) => {
    const channels = [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
    return channels.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
};
const contrast = (a, b) => {
    const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y);
    return (high + .05) / (low + .05);
};
for (const name of ['primary', 'emerald', 'rose', 'amber']) {
    if (contrast('#ffffff', colors[name][600]) < 4.5) issues.push(`${name} filled-action contrast is below 4.5:1`);
}
const rootTokens = Object.fromEntries(tokenRoot.nodes.filter(node => node.type === 'decl').map(node => [node.prop, node.value]));
if (contrast(rootTokens['--mc-accent'], rootTokens['--mc-brand-soft']) < 4.5) issues.push('Accent text on selected surfaces must meet 4.5:1 contrast');
if (contrast(rootTokens['--mc-text-muted'], rootTokens['--mc-surface-muted']) < 4.5) issues.push('Muted text must remain readable on tinted surfaces');

if (issues.length) {
    process.stderr.write(`${issues.join('\n')}\n`);
    process.exitCode = 1;
} else {
    process.stdout.write(`Medicare theme check passed: ${cssFiles.length} stylesheets, ${jsxFiles.length} components/pages, ${declared.size} shared tokens.\n`);
}
