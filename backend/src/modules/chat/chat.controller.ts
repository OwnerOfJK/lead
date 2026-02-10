import { Request, Response } from "express";
import { pipeAgentUIStreamToResponse } from "ai";
import { createContactAgent } from "./agent";

export async function chatHandler(req: Request, res: Response) {
  const agent = createContactAgent(req.user!.sub, req.body.contactId);
  await pipeAgentUIStreamToResponse({
    response: res,
    agent,
    uiMessages: req.body.messages,
  });
}
