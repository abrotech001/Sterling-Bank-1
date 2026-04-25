import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const cryptoWalletsTable = pgTable("crypto_wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id).unique(),
  mnemonic: text("mnemonic").notNull(),
  btcAddress: text("btc_address").notNull(),
  ethAddress: text("eth_address").notNull(),
  usdtAddress: text("usdt_address").notNull(),
  solAddress: text("sol_address").notNull(),
  xrpAddress: text("xrp_address").notNull(),
  btcBalance: numeric("btc_balance", { precision: 24, scale: 8 }).notNull().default("0"),
  ethBalance: numeric("eth_balance", { precision: 24, scale: 8 }).notNull().default("0"),
  usdtBalance: numeric("usdt_balance", { precision: 24, scale: 8 }).notNull().default("0"),
  solBalance: numeric("sol_balance", { precision: 24, scale: 8 }).notNull().default("0"),
  xrpBalance: numeric("xrp_balance", { precision: 24, scale: 8 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type CryptoWallet = typeof cryptoWalletsTable.$inferSelect;

export const cryptoSwapsTable = pgTable("crypto_swaps", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  asset: text("asset").notNull(),
  amount: numeric("amount", { precision: 24, scale: 8 }).notNull(),
  rate: numeric("rate", { precision: 18, scale: 2 }).notNull(),
  cashValue: numeric("cash_value", { precision: 18, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"),
  declineReason: text("decline_reason"),
  telegramMessageId: integer("telegram_message_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type CryptoSwap = typeof cryptoSwapsTable.$inferSelect;
