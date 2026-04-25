// @ts-nocheck
import { Router } from "express";
import { db } from "@workspace/db";
import { savingsVaultsTable, walletsTable, transactionsTable } from "@workspace/db";
import { eq, and, sql, lte } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";

const router = Router();

const RATES: Record<number, number> = {
  7: 0.0075,
  30: 0.02,
  90: 0.05,
  365: 0.08,
};

const MIN_AMOUNT = 10;
const MAX_AMOUNT = 1_000_000;
const EARLY_PENALTY_PCT = 0.02;

function computeReward(amount: number, days: number): { rate: number; reward: number } {
  const rate = RATES[days] ?? 0;
  const reward = +(amount * rate).toFixed(2);
  return { rate, reward };
}

async function maybeMatureVaults(userId: number) {
  const now = new Date();

  const matured = await db
    .update(savingsVaultsTable)
    .set({ status: "completed", completedAt: now })
    .where(
      and(
        eq(savingsVaultsTable.userId, userId),
        eq(savingsVaultsTable.status, "active"),
        lte(savingsVaultsTable.maturityDate, now),
      ),
    )
    .returning();

  if (matured.length === 0) return;

  for (const v of matured) {
    const principal = parseFloat(v.amount);
    const reward = parseFloat(v.expectedReward);
    const credit = principal + reward;

    await db.transaction(async (tx) => {
      await tx
        .update(walletsTable)
        .set({
          balance: sql`${walletsTable.balance} + ${credit}`,
          updatedAt: now,
        })
        .where(eq(walletsTable.userId, userId));

      await tx.insert(transactionsTable).values({
        type: "vault_payout",
        amount: credit.toFixed(2),
        status: "completed",
        receiverId: userId,
        note: `Savings Vault matured (principal $${principal.toFixed(2)} + reward $${reward.toFixed(2)})`,
      });
    });
  }
}

router.post("/quote", requireAuth, async (req, res) => {
  const amountNum = Number(req.body.amount);
  const days = Number(req.body.durationDays);

  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    res.status(400).json({ error: "Amount must be a positive number" });
    return;
  }
  if (!RATES[days]) {
    res.status(400).json({ error: "Duration must be 7, 30, 90, or 365 days" });
    return;
  }

  const { rate, reward } = computeReward(amountNum, days);
  res.json({
    amount: amountNum.toFixed(2),
    durationDays: days,
    ratePct: rate * 100,
    expectedReward: reward.toFixed(2),
    payoutAtMaturity: (amountNum + reward).toFixed(2),
    maturityDate: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
  });
});

router.post("/", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const amountNum = Number(req.body.amount);
  const days = Number(req.body.durationDays);

  if (!Number.isFinite(amountNum) || amountNum < MIN_AMOUNT) {
    res.status(400).json({ error: `Amount must be at least $${MIN_AMOUNT}` });
    return;
  }
  if (amountNum > MAX_AMOUNT) {
    res.status(400).json({ error: `Amount exceeds the per-vault limit of $${MAX_AMOUNT.toLocaleString()}` });
    return;
  }
  if (!RATES[days]) {
    res.status(400).json({ error: "Duration must be 7, 30, 90, or 365 days" });
    return;
  }

  try {
    const { rate, reward } = computeReward(amountNum, days);
    const now = new Date();
    const maturityDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const result = await db.transaction(async (tx) => {
      const [wallet] = await tx
        .select()
        .from(walletsTable)
        .where(eq(walletsTable.userId, userId))
        .for("update");

      if (!wallet || parseFloat(wallet.balance) < amountNum) {
        return { error: "Insufficient funds in your available balance" as const };
      }

      await tx
        .update(walletsTable)
        .set({
          balance: sql`${walletsTable.balance} - ${amountNum}`,
          updatedAt: now,
        })
        .where(eq(walletsTable.userId, userId));

      const [vault] = await tx
        .insert(savingsVaultsTable)
        .values({
          userId,
          amount: amountNum.toFixed(2),
          durationDays: days,
          ratePct: (rate * 100).toFixed(4),
          expectedReward: reward.toFixed(2),
          status: "active",
          startDate: now,
          maturityDate,
        })
        .returning();

      await tx.insert(transactionsTable).values({
        type: "vault_lock",
        amount: amountNum.toFixed(2),
        status: "completed",
        senderId: userId,
        note: `Locked into ${days}-day Savings Vault @ ${(rate * 100).toFixed(2)}%`,
      });

      return { vault };
    });

    if ("error" in result) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({ vault: result.vault });
  } catch (e) {
    req.log.error({ e }, "Error creating savings vault");
    res.status(500).json({ error: "Failed to create savings vault" });
  }
});

router.get("/", requireAuth, async (req, res) => {
  const userId = req.userId!;
  try {
    await maybeMatureVaults(userId);

    const vaults = await db
      .select()
      .from(savingsVaultsTable)
      .where(eq(savingsVaultsTable.userId, userId));

    vaults.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    let totalLocked = 0;
    let totalExpectedReward = 0;
    let totalEarned = 0;
    for (const v of vaults) {
      if (v.status === "active") {
        totalLocked += parseFloat(v.amount);
        totalExpectedReward += parseFloat(v.expectedReward);
      } else if (v.status === "completed") {
        totalEarned += parseFloat(v.expectedReward);
      }
    }

    res.json({
      vaults,
      summary: {
        totalLocked: totalLocked.toFixed(2),
        totalExpectedReward: totalExpectedReward.toFixed(2),
        totalEarned: totalEarned.toFixed(2),
        activeCount: vaults.filter((v) => v.status === "active").length,
        completedCount: vaults.filter((v) => v.status === "completed").length,
      },
      rates: RATES,
    });
  } catch (e) {
    req.log.error({ e }, "Error listing vaults");
    res.status(500).json({ error: "Failed to list savings vaults" });
  }
});

router.post("/:id/withdraw-early", requireAuth, async (req, res) => {
  const userId = req.userId!;
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid vault id" });
    return;
  }

  try {
    const now = new Date();

    const result = await db.transaction(async (tx) => {
      const [vault] = await tx
        .update(savingsVaultsTable)
        .set({ status: "withdrawn_early", earlyWithdrawnAt: now })
        .where(
          and(
            eq(savingsVaultsTable.id, id),
            eq(savingsVaultsTable.userId, userId),
            eq(savingsVaultsTable.status, "active"),
          ),
        )
        .returning();

      if (!vault) {
        return { error: "Vault is not active or not found" as const };
      }

      const principal = parseFloat(vault.amount);
      const penalty = +(principal * EARLY_PENALTY_PCT).toFixed(2);
      const refund = +(principal - penalty).toFixed(2);

      await tx
        .update(walletsTable)
        .set({
          balance: sql`${walletsTable.balance} + ${refund}`,
          updatedAt: now,
        })
        .where(eq(walletsTable.userId, userId));

      await tx.insert(transactionsTable).values({
        type: "vault_early_withdrawal",
        amount: refund.toFixed(2),
        status: "completed",
        receiverId: userId,
        note: `Early withdrawal from Savings Vault — rewards forfeited, 2% penalty $${penalty.toFixed(2)} applied`,
      });

      return { refund, penalty };
    });

    if ("error" in result) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({
      success: true,
      refund: result.refund.toFixed(2),
      penalty: result.penalty.toFixed(2),
      message: "Funds released. Reward forfeited and a 2% early-exit penalty applied.",
    });
  } catch (e) {
    req.log.error({ e }, "Error early-withdrawing vault");
    res.status(500).json({ error: "Failed to release vault funds" });
  }
});

export default router;
