const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '..', 'node_modules', '@nomicfoundation', 'solidity-analyzer', 'index.js');

const cleanModule = [
  "const commentRe = new RegExp('/\\*[\\s\\S]*?\\*/|//.*', 'g');",
  "const importRe = new RegExp('\\bimport\\s+(?:[^\'"]+\\s+from\\s+)?[\'"]([^\'"]+)[\'"]\\s*;', 'g');",
  "const pragmaRe = new RegExp('\\bpragma\\s+solidity\\s+([^;]+);', 'g');",
  "function analyze(source) {",
  "  const src = String(source || '').replace(commentRe, '');",
  "  const imports = [];",
  "  const versionPragmas = [];",
  "  let m;",
  "  while ((m = importRe.exec(src)) !== null) imports.push(m[1]);",
  "  while ((m = pragmaRe.exec(src)) !== null) versionPragmas.push(m[1].trim());",
  "  return { imports, versionPragmas };",
  "}",
  "module.exports = { analyze };"
].join('\n') + '\n';

if (process.platform === 'android' && fs.existsSync(target)) {
  fs.writeFileSync(target, cleanModule, 'utf8');
  console.log('Installed clean Android ARM64 solidity-analyzer shim');
}
