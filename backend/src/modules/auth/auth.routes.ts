import { Router } from "express";
import { validate } from "../../middleware/validate";
import { registerSchema, loginSchema } from "./auth.types";
import { registerHandler, loginHandler } from "./auth.controller";

export const authRouter = Router();

authRouter.post("/register", validate(registerSchema), registerHandler);
authRouter.post("/login", validate(loginSchema), loginHandler);
