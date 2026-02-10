import express from "express";
import cors from "cors";
import { config } from "./config";
import { errorHandler } from "./middleware/errorHandler";
import { authRouter } from "./modules/auth/auth.routes";
import { connectionsRouter } from "./modules/connections/connections.routes";
import { contactsRouter } from "./modules/contacts/contacts.routes";
import { chatRouter } from "./modules/chat/chat.routes";
import "./providers";
import "./types";

const app = express();

app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRouter);
app.use("/connections", connectionsRouter);
app.use("/contacts", contactsRouter);
app.use("/chat", chatRouter);

app.use(errorHandler);

export { app };
