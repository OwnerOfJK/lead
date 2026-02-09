import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users } from "../../db/schema";
import { config } from "../../config";
import { AppError } from "../../middleware/errorHandler";
import type { RegisterInput, LoginInput } from "./auth.types";

function signToken(userId: string, email: string): string {
  return jwt.sign({ sub: userId, email }, config.JWT_SECRET, { expiresIn: "24h" });
}

function sanitizeUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    createdAt: user.createdAt,
  };
}

export async function register(input: RegisterInput) {
  const email = input.email.toLowerCase();

  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    throw new AppError(409, "Email already registered");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);

  const [user] = await db
    .insert(users)
    .values({
      email,
      passwordHash,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
    })
    .returning();

  const token = signToken(user.id, user.email);
  return { user: sanitizeUser(user), token };
}

export async function login(input: LoginInput) {
  const email = input.email.toLowerCase();

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    throw new AppError(401, "Invalid email or password");
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, "Invalid email or password");
  }

  const token = signToken(user.id, user.email);
  return { user: sanitizeUser(user), token };
}
