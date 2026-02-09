import { z } from "zod";

export const tokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
});

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface ProviderConnection {
  id: string;
  userId: string;
  provider: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date | null;
}

export interface RawContact {
  id: string;
  properties: Record<string, unknown>;
}

export interface SourceContact {
  providerId: string;
  provider: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  companyName: string | null;
  jobTitle: string | null;
  raw: Record<string, unknown>;
  sourceUpdatedAt: Date | null;
}

export interface RawInteraction {
  id: string;
  properties: Record<string, unknown>;
  associations?: Record<string, { results: Array<{ id: string }> }>;
}

export interface SourceInteraction {
  interactionId: string;
  providerId: string;
  entityType: string;
  contentText: string | null;
  raw: Record<string, unknown>;
  sourceUpdatedAt: Date | null;
}

export interface WebhookEvent {
  provider: string;
  eventType: string;
  payload: unknown;
}

export interface ContactInput {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  companyName?: string;
  jobTitle?: string;
}

export interface ISourceProvider {
  id: string;
  displayName: string;

  getAuthUrl(userId: string): string;
  handleCallback(code: string): Promise<OAuthTokens>;
  refreshTokens(connection: ProviderConnection): Promise<OAuthTokens>;
  revokeTokens(connection: ProviderConnection): Promise<void>;

  fetchContacts(connection: ProviderConnection): Promise<RawContact[]>;
  normalizeContact(raw: RawContact): SourceContact;

  fetchInteractions(connection: ProviderConnection): Promise<RawInteraction[]>;
  normalizeInteraction(raw: RawInteraction): SourceInteraction;

  handleWebhook(event: WebhookEvent): Promise<void>;
  createContact(connection: ProviderConnection, input: ContactInput): Promise<RawContact>;
  updateContact(connection: ProviderConnection, providerId: string, input: ContactInput): Promise<RawContact>;
}
