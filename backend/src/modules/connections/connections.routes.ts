import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import {
  getAuthUrlHandler,
  oauthCallbackHandler,
  listConnectionsHandler,
  disconnectHandler,
  syncHandler,
} from "./connections.controller";

export const connectionsRouter = Router();

connectionsRouter.get("/", requireAuth, listConnectionsHandler);
connectionsRouter.get("/:provider/auth", requireAuth, getAuthUrlHandler);
connectionsRouter.get("/:provider/callback", oauthCallbackHandler);
connectionsRouter.delete("/:id", requireAuth, disconnectHandler);
connectionsRouter.post("/:id/sync", requireAuth, syncHandler);
