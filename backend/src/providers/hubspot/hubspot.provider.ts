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

const HUBSPOT_AUTH_URL = "https://app.hubspot.com/oauth/authorize";
const HUBSPOT_TOKEN_URL = "https://api.hubapi.com/oauth/v1/token";
const HUBSPOT_API_BASE = "https://api.hubapi.com";
const SCOPES = [
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  "crm.objects.companies.read",
  "crm.objects.companies.write",
  "crm.objects.deals.read",
  "crm.objects.deals.write",
  "crm.schemas.contacts.read",
  "crm.schemas.contacts.write",
  "crm.schemas.companies.read",
  "crm.schemas.companies.write",
];

const paginatedContactsSchema = z.object({
  results: z.array(z.object({
    id: z.string(),
    properties: z.record(z.string(), z.unknown()).optional(),
  })).default([]),
  paging: z.object({
    next: z.object({ after: z.string() }).optional(),
  }).optional(),
});

const paginatedDealsSchema = z.object({
  results: z.array(z.object({
    id: z.string(),
    properties: z.record(z.string(), z.unknown()).optional(),
    associations: z.record(z.string(), z.object({
      results: z.array(z.object({ id: z.string() })),
    })).optional(),
  })).default([]),
  paging: z.object({
    next: z.object({ after: z.string() }).optional(),
  }).optional(),
});

export class HubSpotProvider implements ISourceProvider {
  id = "hubspot";
  displayName = "HubSpot";

  getAuthUrl(userId: string): string {
    const params = new URLSearchParams({
      client_id: config.HUBSPOT_CLIENT_ID,
      redirect_uri: config.HUBSPOT_REDIRECT_URI,
      scope: SCOPES.join(" "),
      state: userId,
    });
    return `${HUBSPOT_AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(code: string): Promise<OAuthTokens> {
    const res = await fetch(HUBSPOT_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: config.HUBSPOT_CLIENT_ID,
        client_secret: config.HUBSPOT_CLIENT_SECRET,
        redirect_uri: config.HUBSPOT_REDIRECT_URI,
        code,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HubSpot token exchange failed: ${res.status} ${body}`);
    }
    const data = tokenResponseSchema.parse(await res.json());
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  async refreshTokens(connection: ProviderConnection): Promise<OAuthTokens> {
    const res = await fetch(HUBSPOT_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: config.HUBSPOT_CLIENT_ID,
        client_secret: config.HUBSPOT_CLIENT_SECRET,
        refresh_token: connection.refreshToken,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HubSpot token refresh failed: ${res.status} ${body}`);
    }
    const data = tokenResponseSchema.parse(await res.json());
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  async revokeTokens(connection: ProviderConnection): Promise<void> {
    const res = await fetch(
      `${HUBSPOT_API_BASE}/oauth/v1/refresh-tokens/${connection.refreshToken}`,
      { method: "DELETE" }
    );
    if (!res.ok && res.status !== 404) {
      const body = await res.text();
      throw new Error(`HubSpot token revocation failed: ${res.status} ${body}`);
    }
  }

  async fetchContacts(connection: ProviderConnection): Promise<RawContact[]> {
    const contacts: RawContact[] = [];
    let after: string | undefined;

    do {
      const params = new URLSearchParams({
        limit: "100",
        properties: "firstname,lastname,email,phone,company,jobtitle",
      });
      if (after) params.set("after", after);

      const res = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts?${params}`, {
        headers: { Authorization: `Bearer ${connection.accessToken}` },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HubSpot fetchContacts failed: ${res.status} ${body}`);
      }

      const data = paginatedContactsSchema.parse(await res.json());
      for (const result of data.results) {
        contacts.push({ id: result.id, properties: (result.properties ?? {}) as Record<string, unknown> });
      }
      after = data.paging?.next?.after;
    } while (after);

    return contacts;
  }

  normalizeContact(raw: RawContact): SourceContact {
    const p = raw.properties as Record<string, string | null>;
    return {
      providerId: raw.id,
      provider: this.id,
      email: p.email || null,
      firstName: p.firstname || null,
      lastName: p.lastname || null,
      phone: p.phone || null,
      companyName: p.company || null,
      jobTitle: p.jobtitle || null,
      raw: raw.properties,
      sourceUpdatedAt: p.lastmodifieddate ? new Date(p.lastmodifieddate) : null,
    };
  }

  async fetchInteractions(connection: ProviderConnection): Promise<RawInteraction[]> {
    const deals: RawInteraction[] = [];
    let after: string | undefined;

    do {
      const params = new URLSearchParams({
        limit: "100",
        properties: "dealname,amount,dealstage,closedate,pipeline",
        associations: "contacts",
      });
      if (after) params.set("after", after);

      const res = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/deals?${params}`, {
        headers: { Authorization: `Bearer ${connection.accessToken}` },
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`HubSpot fetchInteractions failed: ${res.status} ${body}`);
      }

      const data = paginatedDealsSchema.parse(await res.json());
      for (const result of data.results) {
        deals.push({
          id: result.id,
          properties: result.properties ?? {},
          associations: result.associations,
        });
      }
      after = data.paging?.next?.after;
    } while (after);

    return deals;
  }

  normalizeInteraction(raw: RawInteraction): SourceInteraction {
    const p = raw.properties as Record<string, string | null>;
    const contactId = raw.associations?.contacts?.results?.[0]?.id ?? raw.id;
    return {
      interactionId: raw.id,
      providerId: contactId,
      entityType: "deal",
      contentText: p.dealname || null,
      raw: { ...raw.properties, associations: raw.associations },
      sourceUpdatedAt: p.hs_lastmodifieddate ? new Date(p.hs_lastmodifieddate) : null,
    };
  }

  async handleWebhook(_event: WebhookEvent): Promise<void> {
    throw new Error("HubSpot webhooks not implemented");
  }

  async createContact(_connection: ProviderConnection, _input: ContactInput): Promise<RawContact> {
    throw new Error("HubSpot createContact not implemented");
  }

  async updateContact(_connection: ProviderConnection, _providerId: string, _input: ContactInput): Promise<RawContact> {
    throw new Error("HubSpot updateContact not implemented");
  }
}

export const hubspotProvider = new HubSpotProvider();
