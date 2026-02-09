'use client';
import { useState } from 'react';
import type { HubSpotProfile, UserContext } from '@/app/types';
import { fetchContactLinkedIn, transcribeContactCalls } from '../lib/aggregateData';
import ContextCard from './ContextCard';

type Props = {
  lead: HubSpotProfile;
};

export default function CollectData({ lead }: Props) {
  const [contextMap, setContextMap] = useState<Record<string, UserContext>>({});


  async function fetchContactData(lead: HubSpotProfile) {
    console.log("Aggregating data for lead:", lead);
    const linkedinData = await fetchContactLinkedIn(lead);
    const transcriptData = await transcribeContactCalls(lead);

    const combinedContext: UserContext = {
      hubspotProfile: lead,
      linkedinProfile: linkedinData,
      transcription: transcriptData,
    };

    if (!lead.contact_id) {
      console.warn("Missing contact_id in lead:", lead);
    return;
  }

  setContextMap(prev => ({
    ...prev,
    [lead.contact_id!]: combinedContext,
  }));
  }

  return (
    <div>
      <p className="font-semibold">{lead.firstname} {lead.lastname}</p>
      <p className="text-sm text-gray-600">{lead.email}</p>
      {lead.phone && <p className="text-sm text-gray-600">📞 {lead.phone}</p>}
      {lead.lead_status && <p className="text-sm text-gray-600">Status: {lead.lead_status}</p>}
      {lead.linkedin_url && (<p className="text-sm text-blue-600">LinkedIn:{' '}
        <a href={lead.linkedin_url} target="_blank" className="underline" rel="noopener noreferrer"> {lead.linkedin_url}</a>
      </p>)}
      <button
        onClick={() => fetchContactData(lead)}
        className="mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
      >
        Collect Data
      </button>
      {lead.contact_id && contextMap[lead.contact_id] && (
      <ContextCard context={contextMap[lead.contact_id]} />)}
    </div>
  );
}