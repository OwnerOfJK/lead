import { ToolLoopAgent, gateway } from "ai";
import { getContactDetails } from "./tools/get-contact-details";

const INSTRUCTIONS = `You are a contact intelligence assistant. You help users explore a specific contact's profile from their synced CRM and support platforms.

The user is viewing a specific contact. Use getContactDetails with the provided contact ID to retrieve the full profile including source records and interactions.

Present results clearly and concisely.`;

export function createContactAgent(userId: string, contactId: string) {
  return new ToolLoopAgent({
    model: gateway("anthropic/claude-sonnet-4.5"),
    instructions: `${INSTRUCTIONS}\n\nThe current contact ID is: ${contactId}`,
    tools: { getContactDetails },
    experimental_context: { userId },
  });
}
