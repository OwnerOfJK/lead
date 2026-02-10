import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { chatHandler } from "./chat.controller";

export const chatRouter = Router();

chatRouter.post("/", requireAuth, chatHandler);
