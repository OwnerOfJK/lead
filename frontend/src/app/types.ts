export type HubSpotProfile = {
  firstname: string;
  lastname: string;
  email: string;
  phone?: string | undefined;
  lead_status?: string | undefined;
  linkedin_url?: string | undefined;
  contact_id: string | undefined;
  createdate: string;
};

export type LinkedInProfile = {
  name: string | null;
  headline: string | null;
  location: string | null;
};

export type UserContext = {
  hubspotProfile: HubSpotProfile | null;
  linkedinProfile: LinkedInProfile | null;
  transcription: string | null;
}