import { fileURLToPath } from 'node:url';

// Hardhat 3 only emits artifacts for build entry points. Include the original
// public source explicitly, without traversing node_modules as project sources.
export default async () => ({
  build: async (context, paths, options, next) => next(context,
    [...new Set([...paths, fileURLToPath(new URL('./PipelineCapacityToken.sol', import.meta.url))])],
    options),
});
