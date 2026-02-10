import { Request, Response, NextFunction } from "express";
import { eq, and } from "drizzle-orm";
import { providerParamSchema, connectionIdParamSchema } from "./connections.types";
import * as connectionsService from "./connections.service";
import { config } from "../../config";
import { getBoss } from "../../jobs";
import { db } from "../../db";
import { connections } from "../../db/schema";
import { AppError } from "../../middleware/errorHandler";

export async function getAuthUrlHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { provider } = providerParamSchema.parse(req.params);
    const userId = req.user!.sub;
    const url = connectionsService.getAuthUrl(provider, userId);
    res.json({ url });
  } catch (err) {
    next(err);
  }
}

export async function oauthCallbackHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { provider } = providerParamSchema.parse(req.params);
    const code = req.query.code as string;
    const state = req.query.state as string;

    if (!code || !state) {
      res.status(400).json({ error: "Missing code or state parameter" });
      return;
    }

    await connectionsService.handleOAuthCallback(provider, code, state);
    res.redirect(`${config.CORS_ORIGIN}/connections?connected=${provider}`);
  } catch (err) {
    next(err);
  }
}

export async function listConnectionsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.sub;
    const result = await connectionsService.listConnections(userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function disconnectHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = connectionIdParamSchema.parse(req.params);
    const userId = req.user!.sub;
    await connectionsService.disconnect(id, userId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function syncHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = connectionIdParamSchema.parse(req.params);
    const userId = req.user!.sub;

    const [row] = await db
      .select({ id: connections.id })
      .from(connections)
      .where(and(eq(connections.id, id), eq(connections.userId, userId)))
      .limit(1);

    if (!row) throw new AppError(404, "Connection not found");

    const boss = getBoss();
    const jobId = await boss.send("connection-sync", { connectionId: id }, {
      singletonKey: id,
    });

    res.json({ jobId, status: "queued" });
  } catch (err) {
    next(err);
  }
}
