const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

// Root-level Node suites include database, governance, crypto and recovery.
// Discover them without shell globs so new boundary regressions cannot silently
// be omitted from CI, and the command behaves the same on Windows and Linux.
const directory = path.resolve(__dirname,'../tests');
const files = fs.readdirSync(directory).filter(name=>/^[a-z0-9-]+(?:\.integration)?\.test\.js$/.test(name)).sort().map(name=>path.join(directory,name));
if (!files.length) throw new Error('No integration suites were found');
const result = spawnSync(process.execPath,['--test','--test-concurrency=1',...files],{stdio:'inherit',shell:false,timeout:600000});
process.exitCode = result.status ?? 1;
