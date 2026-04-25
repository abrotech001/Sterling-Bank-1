import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const transactionsTable = pgTable("transactions", {
  id: serial("id").primaryKey(),
  type: text("type").notNull(), // transfer, withdrawal, deposit, gift_card, admin_fund
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"), // pending, completed, failed
  note: text("note"),
  declineReason: text("decline_reason"),
  senderId: integer("sender_id").references(() => usersTable.id),
  receiverId: integer("receiver_id").references(() => usersTable.id),
  method: text("method"),
  destination: text("destination"),
  bankName: text("bank_name"),
  accountDetails: text("account_details"),
  telegramMessageId: integer("telegram_message_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTransactionSchema = createInsertSchema(transactionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactionsTable.$inferSelect;
