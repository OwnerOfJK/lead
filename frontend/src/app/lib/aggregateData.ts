import type { HubSpotProfile } from "@/app/types"

export async function fetchContactLinkedIn (lead: HubSpotProfile)  {
    const response = await fetch("/api/linkedin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: lead.linkedin_url }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error fetching LinkedIn profile:", errorData);
      return;
    }
    return await response.json();
};

export async function transcribeContactCalls(lead: HubSpotProfile) {
    const response = await fetch("/api/call", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ callId: lead.contact_id }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Error fetching transcription:", errorData);
      return;
    }
    return await response.json();
};