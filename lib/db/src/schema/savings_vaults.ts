import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const savingsVaultsTable = pgTable("savings_vaults", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  durationDays: integer("duration_days").notNull(),
  ratePct: numeric("rate_pct", { precision: 6, scale: 4 }).notNull(),
  expectedReward: numeric("expected_reward", { precision: 18, scale: 2 }).notNull(),
  status: text("status").notNull().default("active"),
  startDate: timestamp("start_date").notNull().defaultNow(),
  maturityDate: timestamp("maturity_date").notNull(),
  completedAt: timestamp("completed_at"),
  earlyWithdrawnAt: timestamp("early_withdrawn_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSavingsVaultSchema = createInsertSchema(savingsVaultsTable).omit({ id: true, createdAt: true });
export type InsertSavingsVault = z.infer<typeof insertSavingsVaultSchema>;
export type SavingsVault = typeof savingsVaultsTable.$inferSelect;
