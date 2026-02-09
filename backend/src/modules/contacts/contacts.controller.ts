import { Request, Response, NextFunction } from "express";
import { goldenRecordIdParamSchema } from "./contacts.types";
import * as contactsService from "./contacts.service";

export async function listContactsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.sub;
    const result = await contactsService.listGoldenRecords(userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getContactHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = goldenRecordIdParamSchema.parse(req.params);
    const userId = req.user!.sub;
    const result = await contactsService.getGoldenRecordWithSources(id, userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
