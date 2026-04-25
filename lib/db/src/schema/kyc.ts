import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const kycTable = pgTable("kyc", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  tier: integer("tier").notNull().default(2), // 2 = identity, 3 = proof of address
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  fullName: text("full_name").notNull(),
  dateOfBirth: text("date_of_birth").notNull(),
  address: text("address").notNull(),
  idType: text("id_type").notNull(), // passport/national_id/drivers_license OR utility_bill/bank_statement/government_doc
  idNumber: text("id_number").notNull(),
  idFrontImage: text("id_front_image").notNull(),
  idBackImage: text("id_back_image"),
  selfieImage: text("selfie_image"),
  rejectionReason: text("rejection_reason"),
  telegramMessageId: integer("telegram_message_id"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

export const insertKycSchema = createInsertSchema(kycTable).omit({ id: true, submittedAt: true });
export type InsertKyc = z.infer<typeof insertKycSchema>;
export type Kyc = typeof kycTable.$inferSelect;
