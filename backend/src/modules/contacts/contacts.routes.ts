import { Router } from "express";
import { requireAuth } from "../../middleware/auth";
import { listContactsHandler, getContactHandler } from "./contacts.controller";

export const contactsRouter = Router();

contactsRouter.get("/", requireAuth, listContactsHandler);
contactsRouter.get("/:id", requireAuth, getContactHandler);
