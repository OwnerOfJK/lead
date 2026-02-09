import { registerProvider } from "./registry";
import { hubspotProvider } from "./hubspot/hubspot.provider";
import { pipedriveProvider } from "./pipedrive/pipedrive.provider";
import { zendeskProvider } from "./zendesk/zendesk.provider";

registerProvider(hubspotProvider);
registerProvider(pipedriveProvider);
registerProvider(zendeskProvider);
