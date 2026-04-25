import { VercelRequest, VercelResponse } from "@vercel/node";

export type ApiHandler = (req: VercelRequest, res: VercelResponse) => Promise<void> | void;

export function withCors(handler: ApiHandler): ApiHandler {
  return async (req, res) => {
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,OPTIONS,PATCH,DELETE,POST,PUT"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
    );

    if (req.method === "OPTIONS") {
      res.status(200).end();
      return;
    }

    return handler(req, res);
  };
}

export function withAuth(handler: ApiHandler): ApiHandler {
  return async (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const { verifyToken } = await import("../auth");
      const decoded = verifyToken(token);
      if (!decoded) {
        res.status(401).json({ error: "Invalid token" });
        return;
      }
      (req as any).user = decoded;
    } catch (error) {
      res.status(401).json({ error: "Invalid token" });
      return;
    }

    return handler(req, res);
  };
}

export function withErrorHandling(handler: ApiHandler): ApiHandler {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (error: any) {
      console.error("[API Error]", error);
      
      if (error.code === "CONFLICT") {
        res.status(409).json({ error: error.message });
        return;
      }

      if (error.code === "NOT_FOUND") {
        res.status(404).json({ error: error.message });
        return;
      }

      if (error.code === "UNAUTHORIZED") {
        res.status(401).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: "Internal server error" });
    }
  };
}

export function compose(...middlewares: ((h: ApiHandler) => ApiHandler)[]): (handler: ApiHandler) => ApiHandler {
  return (handler: ApiHandler) => {
    return middlewares.reduce((acc, middleware) => middleware(acc), handler);
  };
}
