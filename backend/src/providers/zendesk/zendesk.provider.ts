import { z } from "zod";
import { config } from "../../config";
import type {
  ISourceProvider,
  OAuthTokens,
  ProviderConnection,
  RawContact,
  SourceContact,
  RawInteraction,
  SourceInteraction,
  WebhookEvent,
  ContactInput,
} from "../types";

const subdomain = () => config.ZENDESK_SUBDOMAIN;
const authUrl = () => `https://${subdomain()}.zendesk.com/oauth/authorizations/new`;
const tokenUrl = () => `https://${subdomain()}.zendesk.com/oauth/tokens`;
const apiBase = () => `https://${subdomain()}.zendesk.com/api/v2`;

const SCOPES = "users:read tickets:read";

const zendeskTokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number().default(7200),
});

const paginatedUsersSchema = z.object({
  users: z.array(z.object({
    id: z.number(),
    name: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
  })).default([]),
  meta: z.object({
    has_more: z.boolean(),
  }),
  links: z.object({
    next: z.string().nullable().optional(),
  }).optional(),
});

const paginatedTicketsSchema = z.object({
  tickets: z.array(z.object({
    id: z.number(),
    subject: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    requester_id: z.number().nullable().optional(),
    status: z.string().nullable().optional(),
    updated_at: z.string().nullable().optional(),
  })).default([]),
  meta: z.object({
    has_more: z.boolean(),
  }),
  links: z.object({
    next: z.string().nullable().optional(),
  }).optional(),
});

export class ZendeskProvider implements ISourceProvider {
  id = "zendesk";
  displayName = "Zendesk";

  getAuthUrl(userId: string): string {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.ZENDESK_CLIENT_ID,
      redirect_uri: config.ZENDESK_REDIRECT_URI,
      scope: SCOPES,
      state: userId,
    });
    return `${authUrl()}?${params.toString()}`;
  }

  async handleCallback(code: string): Promise<OAuthTokens> {
    const res = await fetch(tokenUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        client_id: config.ZENDESK_CLIENT_ID,
        client_secret: config.ZENDESK_CLIENT_SECRET,
        redirect_uri: config.ZENDESK_REDIRECT_URI,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Zendesk token exchange failed: ${res.status} ${body}`);
    }
    const data = zendeskTokenSchema.parse(await res.json());
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  async refreshTokens(connection: ProviderConnection): Promise<OAuthTokens> {
    const res = await fetch(tokenUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: connection.refreshToken,
        client_id: config.ZENDESK_CLIENT_ID,
        client_secret: config.ZENDESK_CLIENT_SECRET,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Zendesk token refresh failed: ${res.status} ${body}`);
    }
    const data = zendeskTokenSchema.parse(await res.json());
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  async revokeTokens(connection: ProviderConnection): Promise<void> {
    const res = await fetch(`${apiBase()}/oauth/tokens/current.json`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${connection.accessToken}` },
    });
    if (!res.ok && res.status !== 404) {
      const body = await res.text();
      throw new Error(`Zendesk token revocation failed: ${res.status} ${body}`);
    }
  }

  async fetchContacts(connection: ProviderConnection): Promise<RawContact[]> {
    const contacts: RawContact[] = [];
    let url: string | null = `${apiBase()}/users.json?page[size]=100`;

    do {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${connection.accessToken}` },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Zendesk fetchContacts failed: ${res.status} ${body}`);
      }

      const data = paginatedUsersSchema.parse(await res.json());
      for (const user of data.users) {
        contacts.push({
          id: String(user.id),
          properties: user as unknown as Record<string, unknown>,
        });
      }
      url = data.meta.has_more ? (data.links?.next ?? null) : null;
    } while (url);

    return contacts;
  }

  normalizeContact(raw: RawContact): SourceContact {
    const p = raw.properties as Record<string, unknown>;
    const name = (p.name as string) || "";
    const spaceIdx = name.indexOf(" ");
    const firstName = spaceIdx > 0 ? name.slice(0, spaceIdx) : name;
    const lastName = spaceIdx > 0 ? name.slice(spaceIdx + 1) : null;

    return {
      providerId: raw.id,
      provider: this.id,
      email: (p.email as string) || null,
      firstName: firstName || null,
      lastName,
      phone: (p.phone as string) || null,
      companyName: null,
      jobTitle: null,
      raw: raw.properties,
      sourceUpdatedAt: p.updated_at ? new Date(p.updated_at as string) : null,
    };
  }

  async fetchInteractions(connection: ProviderConnection): Promise<RawInteraction[]> {
    const tickets: RawInteraction[] = [];
    let url: string | null = `${apiBase()}/tickets.json?page[size]=100`;

    do {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${connection.accessToken}` },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Zendesk fetchInteractions failed: ${res.status} ${body}`);
      }

      const data = paginatedTicketsSchema.parse(await res.json());
      for (const ticket of data.tickets) {
        tickets.push({
          id: String(ticket.id),
          properties: ticket as unknown as Record<string, unknown>,
        });
      }
      url = data.meta.has_more ? (data.links?.next ?? null) : null;
    } while (url);

    return tickets;
  }

  normalizeInteraction(raw: RawInteraction): SourceInteraction {
    const p = raw.properties as Record<string, unknown>;
    const requesterId = p.requester_id ? String(p.requester_id) : raw.id;
    return {
      interactionId: raw.id,
      providerId: requesterId,
      entityType: "ticket",
      contentText: (p.subject as string) || null,
      raw: raw.properties,
      sourceUpdatedAt: p.updated_at ? new Date(p.updated_at as string) : null,
    };
  }

  async handleWebhook(_event: WebhookEvent): Promise<void> {
    throw new Error("Zendesk webhooks not implemented");
  }

  async createContact(_connection: ProviderConnection, _input: ContactInput): Promise<RawContact> {
    throw new Error("Zendesk createContact not implemented");
  }

  async updateContact(_connection: ProviderConnection, _providerId: string, _input: ContactInput): Promise<RawContact> {
    throw new Error("Zendesk updateContact not implemented");
  }
}

export const zendeskProvider = new ZendeskProvider();
