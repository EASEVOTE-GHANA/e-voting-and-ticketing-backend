import { Request, Response } from "express";
import { USSDService } from "../services/ussd.service";
import { asyncHandler } from "../middleware/error.middleware";

export const handleUSSDRequest = asyncHandler(async (req: Request, res: Response) => {
  const ussdRequest = {
    USERID: req.body.USERID,
    MSISDN: req.body.MSISDN,
    USERDATA: req.body.USERDATA,
    MSGTYPE: req.body.MSGTYPE
  };

  const response = await USSDService.handleRequest(ussdRequest);

  res.json(response);
});