import type { NextFunction, Request, Response } from "express";
import { getSupabaseAuthClient, type AuthUser } from "./supabase";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      accessToken?: string;
    }
  }
}

const bearer = /^Bearer\s+(.+)$/i;

export const extractAccessToken = (req: Request): string | null => {
  const authorization = req.get("authorization");
  const match = authorization?.match(bearer);
  if (match?.[1]) return match[1].trim();

  const cookieToken = req.cookies?.["sb-access-token"] ?? req.cookies?.["access_token"];
  return typeof cookieToken === "string" && cookieToken ? cookieToken : null;
};

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const token = extractAccessToken(req);
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { data, error } = await (await getSupabaseAuthClient()).auth.getUser(token);
  if (error || !data.user) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }

  req.user = { id: data.user.id, email: data.user.email, role: data.user.role };
  req.accessToken = token;
  next();
};
