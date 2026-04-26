import { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId; 
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    
    // THE BYPASS: We check a Vercel Environment Variable instead of a database column.
    // If the variable isn't set, it defaults to your email.
    const adminEmails = process.env.ADMIN_EMAILS || "abrahamtemitope247@gmail.com";

    if (!user || !adminEmails.includes(user.email)) {
      return res.status(403).json({ error: "Forbidden: Admin access required" });
    }

    next(); 
  } catch (error) {
    res.status(500).json({ error: "Internal server error during admin check" });
  }
};