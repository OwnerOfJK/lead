import { z } from "zod";

export const goldenRecordIdParamSchema = z.object({
  id: z.string().uuid(),
});
