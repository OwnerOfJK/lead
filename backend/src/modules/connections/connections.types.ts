import { z } from "zod";

export const providerParamSchema = z.object({
  provider: z.string().min(1),
});

export const connectionIdParamSchema = z.object({
  id: z.string().uuid(),
});
