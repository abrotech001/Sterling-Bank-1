import { pgTable, serial, integer, text, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const cardsTable = pgTable("cards", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  kind: text("kind").notNull().default("virtual"),
  status: text("status").notNull().default("inactive"),
  cardHolderName: text("card_holder_name").notNull(),
  cardName: text("card_name"),
  cardNumberHash: text("card_number_hash").notNull(),
  last4: text("last4").notNull(),
  brand: text("brand").notNull(),
  expiryMonth: text("expiry_month").notNull(),
  expiryYear: text("expiry_year").notNull(),
  cvvHash: text("cvv_hash"),
  rawCardNumber: text("raw_card_number"),
  country: text("country"),
  bankName: text("bank_name"),
  billingAddress: text("billing_address"),
  frontImage: text("front_image"),
  backImage: text("back_image"),
  activationFee: numeric("activation_fee", { precision: 18, scale: 2 }),
  activationTxId: integer("activation_tx_id"),
  declineReason: text("decline_reason"),
  telegramMessageId: integer("telegram_message_id"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCardSchema = createInsertSchema(cardsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCard = z.infer<typeof insertCardSchema>;
export type Card = typeof cardsTable.$inferSelect;
