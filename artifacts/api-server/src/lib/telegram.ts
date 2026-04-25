import TelegramBot from "node-telegram-bot-api";
import { db } from "@workspace/db";
import { transactionsTable, usersTable, walletsTable, kycTable, notificationsTable, adminLogsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";
import { broadcastToUser } from "./websocket";

const ADMIN_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const SUPPORT_BOT_TOKEN = process.env.TELEGRAM_SUPPORT_BOT_TOKEN || "";
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || "";

let adminBot: TelegramBot | null = null;
let supportBot: TelegramBot | null = null;

export function getAdminBot(): TelegramBot | null {
  return adminBot;
}

export function getSupportBot(): TelegramBot | null {
  return supportBot;
}

export async function initTelegramBots() {
  if (!ADMIN_BOT_TOKEN) {
    logger.warn("TELEGRAM_BOT_TOKEN not set, admin bot disabled");
    return;
  }
  if (!SUPPORT_BOT_TOKEN) {
    logger.warn("TELEGRAM_SUPPORT_BOT_TOKEN not set, support bot disabled");
    return;
  }

  adminBot = new TelegramBot(ADMIN_BOT_TOKEN, { polling: true });
  supportBot = new TelegramBot(SUPPORT_BOT_TOKEN, { polling: true });

  setupAdminBotHandlers(adminBot);
  setupSupportBotHandlers(supportBot);

  logger.info("Telegram bots initialized");
}

function setupAdminBotHandlers(bot: TelegramBot) {
  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Crestfield Bank Admin Bot\n\nCommands:\n/users - List recent users\n/user <id> - User details\n/freeze <id> - Freeze user\n/unfreeze <id> - Unfreeze user\n/setbalance <id> <amount> - Set user balance\n/fund <accountNumber> <amount> <reason> - Fund user\n/logs - Recent admin logs");
  });

  bot.onText(/\/users/, async (msg): Promise<void> => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;
    try {
      const users = await db.select({
        id: usersTable.id,
        email: usersTable.email,
        username: usersTable.username,
        status: usersTable.status,
        kycLevel: usersTable.kycLevel,
        accountNumber: usersTable.accountNumber,
      }).from(usersTable).limit(10).orderBy(sql`${usersTable.createdAt} DESC`);

      const text = users.map(u => `ID: ${u.id} | @${u.username} | ${u.email}\nStatus: ${u.status} | KYC: ${u.kycLevel}\nAcc: ${u.accountNumber}`).join("\n\n");
      bot.sendMessage(msg.chat.id, text || "No users found");
    } catch (e) {
      bot.sendMessage(msg.chat.id, "Error fetching users");
    }
  });

  bot.onText(/\/user (\d+)/, async (msg, match): Promise<void> => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;
    const userId = parseInt(match![1]);
    try {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
      const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
      if (!user) { bot.sendMessage(msg.chat.id, "User not found"); return; }
      bot.sendMessage(msg.chat.id, `User #${user.id}\nEmail: ${user.email}\nUsername: @${user.username}\nPhone: ${user.phone}\nCountry: ${user.country}\nStatus: ${user.status}\nKYC Level: ${user.kycLevel}\nAccount: ${user.accountNumber}\nBalance: $${wallet?.balance || "0.00"}\nPending: $${wallet?.pendingBalance || "0.00"}`);
    } catch (e) {
      bot.sendMessage(msg.chat.id, "Error fetching user");
    }
  });

  bot.onText(/\/freeze (\d+)/, async (msg, match) => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;
    const userId = parseInt(match![1]);
    try {
      await db.update(usersTable).set({ status: "frozen" }).where(eq(usersTable.id, userId));
      await db.insert(adminLogsTable).values({ action: "freeze_user", targetUserId: userId, details: "User frozen via Telegram" });
      bot.sendMessage(msg.chat.id, `User #${userId} has been frozen`);
    } catch (e) {
      bot.sendMessage(msg.chat.id, "Error freezing user");
    }
  });

  bot.onText(/\/unfreeze (\d+)/, async (msg, match) => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;
    const userId = parseInt(match![1]);
    try {
      await db.update(usersTable).set({ status: "active" }).where(eq(usersTable.id, userId));
      await db.insert(adminLogsTable).values({ action: "unfreeze_user", targetUserId: userId, details: "User unfrozen via Telegram" });
      bot.sendMessage(msg.chat.id, `User #${userId} has been unfrozen`);
    } catch (e) {
      bot.sendMessage(msg.chat.id, "Error unfreezing user");
    }
  });

  bot.onText(/\/setbalance (\d+) ([\d.]+)/, async (msg, match) => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;
    const userId = parseInt(match![1]);
    const amount = parseFloat(match![2]);
    try {
      await db.update(walletsTable).set({ balance: amount.toString() }).where(eq(walletsTable.userId, userId));
      await db.insert(adminLogsTable).values({ action: "set_balance", targetUserId: userId, details: `Balance set to $${amount}` });
      bot.sendMessage(msg.chat.id, `User #${userId} balance set to $${amount}`);
    } catch (e) {
      bot.sendMessage(msg.chat.id, "Error setting balance");
    }
  });

  bot.onText(/\/fund (.+) ([\d.]+) (.+)/, async (msg, match): Promise<void> => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;
    const accountNumber = match![1].trim();
    const amount = parseFloat(match![2]);
    const reason = match![3].trim();
    try {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.accountNumber, accountNumber));
      if (!user) { bot.sendMessage(msg.chat.id, "User not found with that account number"); return; }

      await db.update(walletsTable)
        .set({ balance: sql`${walletsTable.balance} + ${amount}` })
        .where(eq(walletsTable.userId, user.id));

      const [tx] = await db.insert(transactionsTable).values({
        type: "admin_fund",
        amount: amount.toString(),
        status: "completed",
        receiverId: user.id,
        note: reason,
      }).returning();

      await db.insert(notificationsTable).values({
        userId: user.id,
        type: "transaction",
        title: "Funds Added to Your Account",
        message: `$${amount.toFixed(2)} has been added to your account. Reason: ${reason}`,
      });

      await db.insert(adminLogsTable).values({
        action: "fund_user",
        targetUserId: user.id,
        details: `Funded $${amount} to ${accountNumber}. Reason: ${reason}`,
      });

      broadcastToUser(user.id, { type: "balance_update", data: { transactionId: tx.id } });

      bot.sendMessage(msg.chat.id, `Successfully funded $${amount} to ${user.username} (${accountNumber})\nReason: ${reason}`);
    } catch (e) {
      bot.sendMessage(msg.chat.id, "Error funding user");
    }
  });

  bot.onText(/\/logs/, async (msg) => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;
    try {
      const logs = await db.select().from(adminLogsTable).limit(10).orderBy(sql`${adminLogsTable.createdAt} DESC`);
      const text = logs.map(l => `${l.action} | User:${l.targetUserId || "N/A"}\n${l.details || ""}\n${l.createdAt}`).join("\n\n");
      bot.sendMessage(msg.chat.id, text || "No logs found");
    } catch (e) {
      bot.sendMessage(msg.chat.id, "Error fetching logs");
    }
  });

  bot.on("callback_query", async (query) => {
    const data = query.data || "";
    const chatId = query.message?.chat.id;
    if (!chatId) return;

    if (data.startsWith("approve_tx_") || data.startsWith("reject_tx_")) {
      const isApprove = data.startsWith("approve_tx_");
      const txId = parseInt(data.replace(isApprove ? "approve_tx_" : "reject_tx_", ""));

      try {
        const [tx] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, txId));
        if (!tx) {
          bot.answerCallbackQuery(query.id, { text: "Transaction not found" });
          return;
        }

        if (tx.status !== "pending") {
          bot.answerCallbackQuery(query.id, { text: "Transaction already processed" });
          return;
        }

        if (isApprove) {
          await db.update(transactionsTable)
            .set({ status: "completed", updatedAt: new Date() })
            .where(eq(transactionsTable.id, txId));

          if (tx.type === "transfer" && tx.senderId && tx.receiverId) {
            await db.update(walletsTable)
              .set({ balance: sql`${walletsTable.balance} - ${tx.amount}`, updatedAt: new Date() })
              .where(eq(walletsTable.userId, tx.senderId));
            await db.update(walletsTable)
              .set({ balance: sql`${walletsTable.balance} + ${tx.amount}`, updatedAt: new Date() })
              .where(eq(walletsTable.userId, tx.receiverId));

            await db.insert(notificationsTable).values([
              { userId: tx.senderId, type: "transaction", title: "Transfer Approved", message: `Your transfer of $${tx.amount} has been processed successfully.` },
              { userId: tx.receiverId, type: "transaction", title: "Funds Received", message: `You have received $${tx.amount}.` },
            ]);
            broadcastToUser(tx.senderId, { type: "transaction_update", data: { transactionId: txId, status: "completed" } });
            broadcastToUser(tx.receiverId, { type: "balance_update", data: { transactionId: txId } });
          } else if (tx.type === "withdrawal" && tx.senderId) {
            await db.update(walletsTable)
              .set({ balance: sql`${walletsTable.balance} - ${tx.amount}`, updatedAt: new Date() })
              .where(eq(walletsTable.userId, tx.senderId));

            await db.insert(notificationsTable).values({
              userId: tx.senderId, type: "transaction", title: "Withdrawal Approved", message: `Your withdrawal of $${tx.amount} has been processed.`,
            });
            broadcastToUser(tx.senderId, { type: "transaction_update", data: { transactionId: txId, status: "completed" } });
          } else if (tx.type === "gift_card" && tx.receiverId) {
            await db.update(walletsTable)
              .set({ balance: sql`${walletsTable.balance} + ${tx.amount}`, updatedAt: new Date() })
              .where(eq(walletsTable.userId, tx.receiverId));

            await db.insert(notificationsTable).values({
              userId: tx.receiverId, type: "transaction", title: "Gift Card Redeemed", message: `Your gift card worth $${tx.amount} has been successfully credited to your account.`,
            });
            broadcastToUser(tx.receiverId, { type: "balance_update", data: { transactionId: txId } });
          }

          await db.insert(adminLogsTable).values({ action: "approve_transaction", details: `Approved TX #${txId} - ${tx.type} $${tx.amount}` });
          bot.answerCallbackQuery(query.id, { text: "Transaction approved!" });
          bot.editMessageText(`Transaction #${txId} - APPROVED\nType: ${tx.type}\nAmount: $${tx.amount}`, {
            chat_id: chatId, message_id: query.message?.message_id, reply_markup: { inline_keyboard: [] }
          });
        } else {
          await db.update(transactionsTable)
            .set({ status: "failed", declineReason: "Declined by administrator", updatedAt: new Date() })
            .where(eq(transactionsTable.id, txId));

          if (tx.senderId) {
            await db.insert(notificationsTable).values({
              userId: tx.senderId, type: "transaction", title: "Transaction Declined", message: `Your ${tx.type} of $${tx.amount} has been declined.`,
            });
            broadcastToUser(tx.senderId, { type: "transaction_update", data: { transactionId: txId, status: "failed" } });
          }

          await db.insert(adminLogsTable).values({ action: "reject_transaction", details: `Rejected TX #${txId} - ${tx.type} $${tx.amount}` });
          bot.answerCallbackQuery(query.id, { text: "Transaction rejected" });
          bot.editMessageText(`Transaction #${txId} - REJECTED\nType: ${tx.type}\nAmount: $${tx.amount}`, {
            chat_id: chatId, message_id: query.message?.message_id, reply_markup: { inline_keyboard: [] }
          });
        }
      } catch (e) {
        logger.error({ e }, "Error processing transaction callback");
        bot.answerCallbackQuery(query.id, { text: "Error processing" });
      }
    }

    if (data.startsWith("approve_kyc_") || data.startsWith("reject_kyc_")) {
      const isApprove = data.startsWith("approve_kyc_");
      const kycId = parseInt(data.replace(isApprove ? "approve_kyc_" : "reject_kyc_", ""));

      try {
        const [kyc] = await db.select().from(kycTable).where(eq(kycTable.id, kycId));
        if (!kyc) {
          bot.answerCallbackQuery(query.id, { text: "KYC not found" });
          return;
        }

        if (isApprove) {
          await db.update(kycTable).set({ status: "approved", reviewedAt: new Date() }).where(eq(kycTable.id, kycId));
          await db.update(usersTable).set({ kycLevel: 1 }).where(eq(usersTable.id, kyc.userId));
          await db.insert(notificationsTable).values({
            userId: kyc.userId, type: "kyc", title: "Identity Verified", message: "Your identity has been verified. You now have full access to all banking features.",
          });
          broadcastToUser(kyc.userId, { type: "kyc_update", data: { status: "approved" } });
          bot.answerCallbackQuery(query.id, { text: "KYC Approved!" });
          bot.editMessageText(`KYC #${kycId} - APPROVED\nUser: ${kyc.fullName}`, {
            chat_id: chatId, message_id: query.message?.message_id, reply_markup: { inline_keyboard: [] }
          });
        } else {
          await db.update(kycTable).set({ status: "rejected", rejectionReason: "Documents not accepted", reviewedAt: new Date() }).where(eq(kycTable.id, kycId));
          await db.insert(notificationsTable).values({
            userId: kyc.userId, type: "kyc", title: "Verification Unsuccessful", message: "Your identity verification was not approved. Please resubmit with clearer documents.",
          });
          broadcastToUser(kyc.userId, { type: "kyc_update", data: { status: "rejected" } });
          bot.answerCallbackQuery(query.id, { text: "KYC Rejected" });
          bot.editMessageText(`KYC #${kycId} - REJECTED\nUser: ${kyc.fullName}`, {
            chat_id: chatId, message_id: query.message?.message_id, reply_markup: { inline_keyboard: [] }
          });
        }
      } catch (e) {
        bot.answerCallbackQuery(query.id, { text: "Error processing KYC" });
      }
    }
  });
}

function setupSupportBotHandlers(bot: TelegramBot) {
  bot.on("message", async (msg) => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;
    if (!msg.text || msg.text.startsWith("/")) return;

    const replyToId = msg.reply_to_message?.message_id;
    if (!replyToId) {
      bot.sendMessage(msg.chat.id, "Reply to a user message to respond to them");
      return;
    }

    try {
      const [originalMsg] = await db.select().from(supportMessagesTable).where(
        eq(supportMessagesTable.telegramMessageId, replyToId)
      );

      if (!originalMsg) {
        bot.sendMessage(msg.chat.id, "Could not find original message");
        return;
      }

      await db.insert(supportMessagesTable).values({
        userId: originalMsg.userId,
        message: msg.text,
        isFromUser: false,
      });

      await db.insert(notificationsTable).values({
        userId: originalMsg.userId,
        type: "support",
        title: "New Support Reply",
        message: "You have a new message from our support team.",
      });

      broadcastToUser(originalMsg.userId, { type: "support_message", data: { message: msg.text } });
      bot.sendMessage(msg.chat.id, "Reply sent to user");
    } catch (e) {
      bot.sendMessage(msg.chat.id, "Error sending reply");
    }
  });
}

import { supportMessagesTable } from "@workspace/db";

export async function sendTransactionAlert(
  txId: number,
  type: string,
  amount: string,
  senderInfo: string,
  receiverInfo: string,
  extraDetails?: string
) {
  if (!adminBot || !ADMIN_CHAT_ID) return null;

  try {
    const msg = await adminBot.sendMessage(
      ADMIN_CHAT_ID,
      `🚨 ${type.toUpperCase()} REQUEST\n\nFrom: ${senderInfo}\nTo: ${receiverInfo}\nAmount: $${amount}${extraDetails ? "\n" + extraDetails : ""}\n\nTransaction ID: #${txId}`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Approve", callback_data: `approve_tx_${txId}` },
            { text: "❌ Reject", callback_data: `reject_tx_${txId}` },
          ]]
        }
      }
    );
    return msg.message_id;
  } catch (e) {
    logger.error({ e }, "Error sending transaction alert");
    return null;
  }
}

export async function sendKycAlert(
  kycId: number,
  userId: number,
  fullName: string,
  idType: string,
  country: string
) {
  if (!adminBot || !ADMIN_CHAT_ID) return null;

  try {
    const msg = await adminBot.sendMessage(
      ADMIN_CHAT_ID,
      `📋 KYC VERIFICATION REQUEST\n\nKYC ID: #${kycId}\nUser ID: #${userId}\nFull Name: ${fullName}\nID Type: ${idType}\nCountry: ${country}\n\nPlease review the submitted documents.`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Approve KYC", callback_data: `approve_kyc_${kycId}` },
            { text: "❌ Reject KYC", callback_data: `reject_kyc_${kycId}` },
          ]]
        }
      }
    );
    return msg.message_id;
  } catch (e) {
    logger.error({ e }, "Error sending KYC alert");
    return null;
  }
}

export async function sendSupportMessageToAdmin(
  userId: number,
  username: string,
  message: string,
  telegramMsgId: number
) {
  if (!supportBot || !ADMIN_CHAT_ID) return;

  try {
    await supportBot.sendMessage(
      ADMIN_CHAT_ID,
      `💬 SUPPORT MESSAGE\n\nFrom: @${username} (User #${userId})\n\n${message}\n\nReply to this message to respond to the user.`,
    );
  } catch (e) {
    logger.error({ e }, "Error sending support message to admin");
  }
}

export async function sendGiftCardAlert(
  txId: number,
  userId: number,
  username: string,
  brand: string,
  code: string,
  amount: string
) {
  if (!adminBot || !ADMIN_CHAT_ID) return null;

  try {
    const msg = await adminBot.sendMessage(
      ADMIN_CHAT_ID,
      `🎁 GIFT CARD SUBMISSION\n\nUser: @${username} (ID: #${userId})\nBrand: ${brand}\nCode: ${code}\nDeclared Value: $${amount}\n\nTransaction ID: #${txId}`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Approve", callback_data: `approve_tx_${txId}` },
            { text: "❌ Decline", callback_data: `reject_tx_${txId}` },
          ]]
        }
      }
    );
    return msg.message_id;
  } catch (e) {
    logger.error({ e }, "Error sending gift card alert");
    return null;
  }
}

export async function sendNewUserAlert(opts: {
  userId: number;
  email: string;
  username: string;
  firstName?: string | null;
  lastName?: string | null;
  phone: string;
  country: string;
  accountNumber: string;
  ipAddress?: string | null;
}) {
  if (!adminBot || !ADMIN_CHAT_ID) return null;

  const fullName = [opts.firstName, opts.lastName].filter(Boolean).join(" ") || "—";

  try {
    const msg = await adminBot.sendMessage(
      ADMIN_CHAT_ID,
      `👤 NEW USER REGISTERED\n\n` +
      `Name: ${fullName}\n` +
      `Username: @${opts.username}\n` +
      `Email: ${opts.email}\n` +
      `Phone: ${opts.phone}\n` +
      `Country: ${opts.country}\n` +
      `Account: ${opts.accountNumber}\n` +
      (opts.ipAddress ? `IP: ${opts.ipAddress}\n` : "") +
      `\nUser ID: #${opts.userId}`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: "🧊 Freeze", callback_data: `freeze_user_${opts.userId}` },
            { text: "💰 Fund", callback_data: `fund_user_${opts.userId}` },
          ]]
        }
      }
    );
    return msg.message_id;
  } catch (e) {
    logger.error({ e }, "Error sending new user alert");
    return null;
  }
}
