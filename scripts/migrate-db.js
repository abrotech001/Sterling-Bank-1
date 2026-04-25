#!/usr/bin/env node

/**
 * Database Migration Script for Vercel Deployment
 * 
 * This script runs Drizzle ORM migrations using the DATABASE_URL
 * environment variable set in Vercel project settings.
 * 
 * Usage: node scripts/migrate-db.js
 */

import { execSync } from "child_process";

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL environment variable is not set");
  console.error("Please add DATABASE_URL to your Vercel environment variables");
  process.exit(1);
}

console.log("🚀 Starting Drizzle ORM push...");
console.log(`📦 Database: ${process.env.DATABASE_URL.split("@")[1]?.split("/")[0] || "unknown"}`);

try {
  // Run drizzle-kit push to synchronize schema with database
  execSync("pnpm run --filter @workspace/db push", {
    stdio: "inherit",
  });
  console.log("✅ Database migration completed successfully!");
} catch (error) {
  console.error("❌ Database migration failed");
  console.error("Make sure:");
  console.error("  1. DATABASE_URL is correctly set in Vercel environment variables");
  console.error("  2. The Neon database is accessible from your Vercel environment");
  console.error("  3. All database credentials are correct");
  process.exit(1);
}
