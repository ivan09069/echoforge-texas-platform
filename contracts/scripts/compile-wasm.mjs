import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const solc = require('solc');

function findImports(importPath) {
  const candidates = [
    path.resolve(rootDir, importPath),
    path.resolve(rootDir, 'node_modules', importPath),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return { contents: fs.readFileSync(c, 'utf8') };
    }
  }
  return { error: `File not found: ${importPath}` };
}

const contractFile = 'PipelineCapacityToken.sol';
const source = fs.readFileSync(path.resolve(rootDir, contractFile), 'utf8');

const input = {
  language: 'Solidity',
  sources: { [contractFile]: { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    viaIR: true,
    evmVersion: 'cancun',
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode', 'evm.deployedBytecode'] } },
  },
};

console.log(`Compiling ${contractFile} with solc WASM (${solc.version()})...`);
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

if (output.errors) {
  let hasError = false;
  for (const err of output.errors) {
    console.log(err.formattedMessage.trim());
    if (err.severity === 'error') hasError = true;
  }
  if (hasError) process.exit(1);
}

const compiled = output.contracts[contractFile]?.PipelineCapacityToken;
if (!compiled) {
  console.error('Failed to locate PipelineCapacityToken in compiler output');
  process.exit(1);
}

const outDir = path.resolve(rootDir, 'artifacts');
fs.mkdirSync(outDir, { recursive: true });
const artifactPath = path.resolve(outDir, 'PipelineCapacityToken.json');

const artifact = {
  _format: 'hh-sol-artifact-1',
  contractName: 'PipelineCapacityToken',
  sourceName: contractFile,
  abi: compiled.abi,
  bytecode: '0x' + compiled.evm.bytecode.object,
  deployedBytecode: '0x' + compiled.evm.deployedBytecode.object,
};

fs.writeFileSync(artifactPath + '.tmp', JSON.stringify(artifact, null, 2) + '\n');
fs.renameSync(artifactPath + '.tmp', artifactPath);
console.log(`Compiled successfully -> contracts/artifacts/PipelineCapacityToken.json (${(artifact.deployedBytecode.length - 2) / 2} bytes runtime)`);
