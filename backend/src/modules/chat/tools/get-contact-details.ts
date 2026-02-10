import { tool } from "ai";
import type { ToolExecutionOptions } from "ai";
import { z } from "zod";
import { getGoldenRecordWithSources } from "../../contacts/contacts.service";

const inputSchema = z.object({
  contactId: z.string().uuid().describe("Golden record UUID"),
});

export const getContactDetails = tool({
  description:
    "Get full contact profile including all source records and interactions.",
  inputSchema,
  execute: async (
    { contactId }: z.infer<typeof inputSchema>,
    options: ToolExecutionOptions
  ) => {
    const userId = (options as any).experimental_context?.userId as string;
    const record = await getGoldenRecordWithSources(contactId, userId);
    return {
      id: record.id,
      email: record.email,
      firstName: record.firstName,
      lastName: record.lastName,
      phone: record.phone,
      sourceUpdatedAt: record.sourceUpdatedAt,
      sources: record.sources.map((s) => ({
        provider: s.provider,
        providerId: s.providerId,
        email: s.email,
        firstName: s.firstName,
        lastName: s.lastName,
        companyName: s.companyName,
        jobTitle: s.jobTitle,
        phone: s.phone,
        category: s.category,
      })),
      interactions: record.interactions.map((i) => ({
        interactionId: i.interactionId,
        providerId: i.providerId,
        entityType: i.entityType,
        contentText: i.contentText,
        sourceUpdatedAt: i.sourceUpdatedAt,
      })),
    };
  },
});
