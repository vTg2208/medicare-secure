import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const assets = path.join(root, 'src/assets/fonts');
const manifest = JSON.parse(fs.readFileSync(path.join(assets, 'manifest.json'), 'utf8'));
const known = new Set(fs.readFileSync(path.join(assets, 'material-symbols.codepoints'), 'utf8').split('\n').map(line => line.split(' ')[0]));
const included = new Set(manifest.icons);
function source(directory) {
    return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const file = path.join(directory, entry.name);
        return entry.isDirectory() ? source(file) : /\.(jsx?|css)$/.test(file) && !file.includes('.test.') ? [file] : [];
    });
}
const files = source(path.join(root, 'src')).map(file => [file, fs.readFileSync(file, 'utf8')]);
const text = files.map(([, contents]) => contents).join('\n');
// A stylesheet can supply an icon via generated content. Its other property
// values (such as text wrapping) cannot invoke a font ligature.
const ligatures = files.map(([file, contents]) => file.endsWith('.css')
    ? (contents.match(/\bcontent\s*:[^;}]+/g) || []).join(' ')
    : contents).join('\n');
const missing = [...new Set(ligatures.match(/[a-z][a-z0-9_]+/g))].filter(word => known.has(word) && !included.has(word));
if (missing.length) throw Error(`Refresh the self-hosted icon subset with npm run vendor:fonts: ${missing.join(', ')}`);
if (/fonts\.(googleapis|gstatic)\.com/.test(text + fs.readFileSync(path.join(root, 'index.html'), 'utf8'))) throw Error('Runtime font loading must remain self-hosted');
for (const font of manifest.files) {
    const bytes = fs.readFileSync(path.join(assets, font.filename));
    if (bytes.toString('ascii',0,4) !== 'wOF2' || createHash('sha256').update(bytes).digest('hex') !== font.sha256) throw Error(`Font integrity mismatch: ${font.filename}`);
}
process.stdout.write(`Self-hosted font check passed: ${manifest.files.length} WOFF2 files, ${manifest.icons.length} icon names.\n`);
