import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Declare Turbopack config so Next.js 16 doesn't error on the webpack block.
  // WASM + Solana polyfills still run via `--webpack` in the build/dev scripts.
  turbopack: {},

  webpack: (config, { isServer }) => {
    // Required for @umbra-privacy/web-zk-prover (WASM modules)
    config.experiments = { ...config.experiments, asyncWebAssembly: true };

    // Suppress the "Critical dependency: expression in require()" warning from
    // web-worker/cjs/node.js (a transitive dep of snarkjs/ffjavascript).
    // That file is Node-only; in the browser bundle it's never executed.
    config.module = config.module ?? {};
    config.module.exprContextCritical = false;

    // Polyfill node builtins used by @solana/web3.js in browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
        "process/browser": false,
        // web-worker's node.js entry is never used in the browser
        worker_threads: false,
      };
    }

    return config;
  },
};

export default nextConfig;
