import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";
import { rm, copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

// Plugins (e.g. 'esbuild-plugin-pino') may use `require` to resolve dependencies
globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  await rm(distDir, { recursive: true, force: true });

  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    external: [
      "*.node", "sharp", "better-sqlite3", "sqlite3", "canvas", "bcrypt",
      "argon2", "fsevents", "re2", "farmhash", "xxhash-addon", "bufferutil",
      "utf-8-validate", "ssh2", "cpu-features", "dtrace-provider", "isolated-vm",
      "lightningcss", "pg-native", "oracledb", "mongodb-client-encryption",
      "nodemailer", "handlebars", "knex", "typeorm", "protobufjs",
      "onnxruntime-node", "@tensorflow/*", "@prisma/client", "@mikro-orm/*",
      "@grpc/*", "@swc/*", "@aws-sdk/*", "@azure/*", "@opentelemetry/*",
      "@google-cloud/*", "@google/*", "googleapis", "firebase-admin",
      "@parcel/watcher", "@sentry/profiling-node", "@tree-sitter/*",
      "aws-sdk", "classic-level", "dd-trace", "ffi-napi", "grpc", "hiredis",
      "kerberos", "leveldown", "miniflare", "mysql2", "newrelic", "odbc",
      "piscina", "realm", "ref-napi", "rocksdb", "sass-embedded", "sequelize",
      "serialport", "snappy", "tinypool", "usb", "workerd", "wrangler",
      "zeromq", "zeromq-prebuilt", "playwright", "puppeteer", "puppeteer-core",
      "electron",
    ],
    sourcemap: "linked",
    plugins: [
      esbuildPluginPino({ transports: ["pino-pretty"] })
    ],
    banner: {
      js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
    `,
    },
  });
}

async function copyAssets() {
  const distDir = path.resolve(artifactDir, "dist");
  await mkdir(distDir, { recursive: true });

  try {
    const req = createRequire(import.meta.url);
    // Find exactly where Node resolved the package
    const mainPath = req.resolve("tiny-secp256k1");
    const baseDir = path.dirname(mainPath);

    // Because of pnpm's symlinks and different package structures (cjs vs esm),
    // the WASM file could be in a few different relative spots. We check them all.
    const possibleWasmPaths = [
      path.join(baseDir, "secp256k1.wasm"),               // If main is in /lib
      path.join(baseDir, "..", "secp256k1.wasm"),         // If main is in /lib/cjs
      path.join(baseDir, "..", "..", "secp256k1.wasm"),   // Safety fallback
      path.join(artifactDir, "../../node_modules/.pnpm/tiny-secp256k1@2.2.4/node_modules/tiny-secp256k1/lib/secp256k1.wasm") // The old hardcoded fallback
    ];

    let found = false;
    for (const wasmPath of possibleWasmPaths) {
      if (existsSync(wasmPath)) {
        await copyFile(wasmPath, path.resolve(distDir, "secp256k1.wasm"));
        console.log(`✅ SUCCESS: Found and copied secp256k1.wasm from: ${wasmPath}`);
        found = true;
        break;
      }
    }

    if (!found) {
      console.error("❌ ERROR: Could not find secp256k1.wasm. Crypto functions will crash!");
    }
  } catch (err) {
    console.error("❌ Failed to resolve tiny-secp256k1:", err.message);
  }
}

buildAll()
  .then(copyAssets)
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });