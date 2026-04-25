#!/usr/bin/env node

/**
 * Vercel Deployment Verification Script
 * 
 * Checks if all required files and configurations are in place
 * for successful Vercel deployment with Neon database
 */

import { existsSync } from "fs";
import { readFileSync } from "fs";
import path from "path";

const checks = [];
const projectRoot = process.cwd();

function checkFile(name, filePath) {
  const exists = existsSync(filePath);
  checks.push({
    name,
    status: exists ? "✅" : "❌",
    exists,
    path: filePath,
  });
  return exists;
}

function checkEnvVariable(varName) {
  const exists = !!process.env[varName];
  checks.push({
    name: `Environment: ${varName}`,
    status: exists ? "✅" : "⚠️",
    exists,
  });
  return exists;
}

function checkJsonFile(name, filePath, requiredKeys = []) {
  if (!existsSync(filePath)) {
    checks.push({
      name: `${name} (file not found)`,
      status: "❌",
      exists: false,
    });
    return false;
  }

  try {
    const content = JSON.parse(readFileSync(filePath, "utf-8"));
    const hasAllKeys = requiredKeys.every((key) => key in content);
    checks.push({
      name: `${name} (structure)`,
      status: hasAllKeys ? "✅" : "❌",
      exists: hasAllKeys,
    });
    return hasAllKeys;
  } catch {
    checks.push({
      name: `${name} (parse error)`,
      status: "❌",
      exists: false,
    });
    return false;
  }
}

console.log("\n🔍 Sterling Bank - Vercel Deployment Verification\n");
console.log("Checking configuration files...\n");

// Check configuration files
checkFile("vercel.json", path.join(projectRoot, "vercel.json"));
checkFile(".env.example", path.join(projectRoot, ".env.example"));
checkFile(
  "Database migration script",
  path.join(projectRoot, "scripts/migrate-db.js"),
);
checkFile(
  "Deployment guide",
  path.join(projectRoot, "VERCEL_DEPLOYMENT.md"),
);

// Check monorepo structure
checkFile(
  "API Server package.json",
  path.join(projectRoot, "artifacts/api-server/package.json"),
);
checkFile(
  "Sterling Crest package.json",
  path.join(projectRoot, "artifacts/sterling-crest/package.json"),
);
checkFile(
  "Mockup Sandbox package.json",
  path.join(projectRoot, "artifacts/mockup-sandbox/package.json"),
);

// Check database configuration
checkFile(
  "Database package.json",
  path.join(projectRoot, "lib/db/package.json"),
);
checkFile(
  "Drizzle config",
  path.join(projectRoot, "lib/db/drizzle.config.ts"),
);
checkFile(
  "Database schema",
  path.join(projectRoot, "lib/db/src/schema/index.ts"),
);

// Check workspace configuration
checkJsonFile(
  "pnpm-workspace.yaml",
  path.join(projectRoot, "pnpm-workspace.yaml"),
);

// Check package.json structure
checkJsonFile("Root package.json", path.join(projectRoot, "package.json"), [
  "name",
  "version",
]);

console.log("\n📋 Verification Results:\n");
checks.forEach((check) => {
  console.log(`  ${check.status} ${check.name}`);
});

const passedChecks = checks.filter((c) => c.exists).length;
const totalChecks = checks.length;
const warningChecks = checks.filter((c) => c.status === "⚠️").length;
const failedChecks = totalChecks - passedChecks - warningChecks;

console.log(`\n📊 Summary: ${passedChecks}/${totalChecks} checks passed\n`);

if (failedChecks > 0) {
  console.log(
    `⚠️  ${failedChecks} check(s) failed. Please review the configuration.`,
  );
  console.log(
    "\nFor setup instructions, see: VERCEL_DEPLOYMENT.md or DEPLOYMENT_CHECKLIST.md\n",
  );
  process.exit(1);
}

if (warningChecks > 0) {
  console.log(
    `✅ All files present, but ${warningChecks} environment variable(s) not set locally`,
  );
  console.log(
    "   (This is normal - they will be set in Vercel environment variables)\n",
  );
}

console.log("✅ All checks passed! Ready for Vercel deployment.\n");
console.log("📚 Next steps:");
console.log("  1. Add DATABASE_URL to Vercel environment variables");
console.log("  2. Push code to main branch");
console.log("  3. Monitor deployment in Vercel dashboard\n");
