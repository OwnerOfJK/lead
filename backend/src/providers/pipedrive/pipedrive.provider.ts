import { z } from "zod";
import { config } from "../../config";
import { tokenResponseSchema } from "../types";
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

const PIPEDRIVE_AUTH_URL = "https://oauth.pipedrive.com/oauth/authorize";
const PIPEDRIVE_TOKEN_URL = "https://oauth.pipedrive.com/oauth/token";
const PIPEDRIVE_REVOKE_URL = "https://oauth.pipedrive.com/oauth/revoke";
const PIPEDRIVE_API_BASE = "https://api.pipedrive.com/v2";

const paginatedPersonsSchema = z.object({
  success: z.boolean(),
  data: z.array(z.object({
    id: z.number(),
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
    emails: z.array(z.object({ value: z.string() })).default([]),
    phones: z.array(z.object({ value: z.string() })).default([]),
    org_name: z.string().nullable().optional(),
    job_title: z.string().nullable().optional(),
    update_time: z.string().nullable().optional(),
  })).default([]),
  additional_data: z.object({
    next_cursor: z.string().nullable().optional(),
  }).optional(),
});

const paginatedDealsSchema = z.object({
  success: z.boolean(),
  data: z.array(z.object({
    id: z.number(),
    title: z.string().nullable().optional(),
    value: z.number().nullable().optional(),
    person_id: z.number().nullable().optional(),
    status: z.string().nullable().optional(),
    update_time: z.string().nullable().optional(),
  })).default([]),
  additional_data: z.object({
    next_cursor: z.string().nullable().optional(),
  }).optional(),
});

function basicAuthHeader(): string {
  return `Basic ${btoa(`${config.PIPEDRIVE_CLIENT_ID}:${config.PIPEDRIVE_CLIENT_SECRET}`)}`;
}

export class PipedriveProvider implements ISourceProvider {
  id = "pipedrive";
  displayName = "Pipedrive";

  getAuthUrl(userId: string): string {
    const params = new URLSearchParams({
      client_id: config.PIPEDRIVE_CLIENT_ID,
      redirect_uri: config.PIPEDRIVE_REDIRECT_URI,
      state: userId,
    });
    return `${PIPEDRIVE_AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(code: string): Promise<OAuthTokens> {
    const res = await fetch(PIPEDRIVE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: basicAuthHeader(),
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: config.PIPEDRIVE_REDIRECT_URI,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Pipedrive token exchange failed: ${res.status} ${body}`);
    }
    const data = tokenResponseSchema.parse(await res.json());
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  async refreshTokens(connection: ProviderConnection): Promise<OAuthTokens> {
    const res = await fetch(PIPEDRIVE_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: basicAuthHeader(),
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: connection.refreshToken,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Pipedrive token refresh failed: ${res.status} ${body}`);
    }
    const data = tokenResponseSchema.parse(await res.json());
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  async revokeTokens(connection: ProviderConnection): Promise<void> {
    const res = await fetch(PIPEDRIVE_REVOKE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: basicAuthHeader(),
      },
      body: new URLSearchParams({
        token: connection.accessToken,
        token_type_hint: "access_token",
      }),
    });
    if (!res.ok && res.status !== 404) {
      const body = await res.text();
      throw new Error(`Pipedrive token revocation failed: ${res.status} ${body}`);
    }
  }

  async fetchContacts(connection: ProviderConnection): Promise<RawContact[]> {
    const contacts: RawContact[] = [];
    let cursor: string | undefined;

    do {
      const params = new URLSearchParams({ limit: "100" });
      if (cursor) params.set("cursor", cursor);

      const res = await fetch(`${PIPEDRIVE_API_BASE}/persons?${params}`, {
        headers: { Authorization: `Bearer ${connection.accessToken}` },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Pipedrive fetchContacts failed: ${res.status} ${body}`);
      }

      const data = paginatedPersonsSchema.parse(await res.json());
      for (const person of data.data) {
        contacts.push({
          id: String(person.id),
          properties: person as unknown as Record<string, unknown>,
        });
      }
      cursor = data.additional_data?.next_cursor ?? undefined;
    } while (cursor);

    return contacts;
  }

  normalizeContact(raw: RawContact): SourceContact {
    const p = raw.properties as Record<string, unknown>;
    const emails = p.emails as Array<{ value: string }> | undefined;
    const phones = p.phones as Array<{ value: string }> | undefined;
    return {
      providerId: raw.id,
      provider: this.id,
      email: emails?.[0]?.value || null,
      firstName: (p.first_name as string) || null,
      lastName: (p.last_name as string) || null,
      phone: phones?.[0]?.value || null,
      companyName: (p.org_name as string) || null,
      jobTitle: (p.job_title as string) || null,
      raw: raw.properties,
      sourceUpdatedAt: p.update_time ? new Date(p.update_time as string) : null,
    };
  }

  async fetchInteractions(connection: ProviderConnection): Promise<RawInteraction[]> {
    const deals: RawInteraction[] = [];
    let cursor: string | undefined;

    do {
      const params = new URLSearchParams({ limit: "100" });
      if (cursor) params.set("cursor", cursor);

      const res = await fetch(`${PIPEDRIVE_API_BASE}/deals?${params}`, {
        headers: { Authorization: `Bearer ${connection.accessToken}` },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Pipedrive fetchInteractions failed: ${res.status} ${body}`);
      }

      const data = paginatedDealsSchema.parse(await res.json());
      for (const deal of data.data) {
        deals.push({
          id: String(deal.id),
          properties: deal as unknown as Record<string, unknown>,
        });
      }
      cursor = data.additional_data?.next_cursor ?? undefined;
    } while (cursor);

    return deals;
  }

  normalizeInteraction(raw: RawInteraction): SourceInteraction {
    const p = raw.properties as Record<string, unknown>;
    const personId = p.person_id ? String(p.person_id) : raw.id;
    return {
      interactionId: raw.id,
      providerId: personId,
      entityType: "deal",
      contentText: (p.title as string) || null,
      raw: raw.properties,
      sourceUpdatedAt: p.update_time ? new Date(p.update_time as string) : null,
    };
  }

  async handleWebhook(_event: WebhookEvent): Promise<void> {
    throw new Error("Pipedrive webhooks not implemented");
  }

  async createContact(_connection: ProviderConnection, _input: ContactInput): Promise<RawContact> {
    throw new Error("Pipedrive createContact not implemented");
  }

  async updateContact(_connection: ProviderConnection, _providerId: string, _input: ContactInput): Promise<RawContact> {
    throw new Error("Pipedrive updateContact not implemented");
  }
}

export const pipedriveProvider = new PipedriveProvider();
