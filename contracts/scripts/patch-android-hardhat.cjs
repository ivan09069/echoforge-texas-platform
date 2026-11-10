const fs = require('fs');
const path = require('path');

function analyze(source) {
  const src = String(source || '').replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
  const imports = [];
  const versionPragmas = [];
  const importRe = /\bimport\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"]\s*;/g;
  const pragmaRe = /\bpragma\s+solidity\s+([^;]+);/g;
  let m;
  while ((m = importRe.exec(src)) !== null) imports.push(m[1]);
  while ((m = pragmaRe.exec(src)) !== null) versionPragmas.push(m[1].trim());
  return { imports, versionPragmas };
}

const target = path.join(__dirname, '..', 'node_modules', '@nomicfoundation', 'solidity-analyzer', 'index.js');

if (process.platform === 'android' && fs.existsSync(target)) {
  fs.writeFileSync(target, analyze.toString() + '\nmodule.exports = { analyze };\n', 'utf8');
  console.log('Installed clean Android ARM64 solidity-analyzer shim');
}
