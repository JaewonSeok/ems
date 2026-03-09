import { Router } from "express";
import { getTeamMemberRecords, getTeamSummary, listTeamMembers } from "../controllers/team-records.controller";
import { authMiddleware } from "../middleware/auth";

const teamRecordsRoutes = Router();

teamRecordsRoutes.use(authMiddleware);

teamRecordsRoutes.get("/members", listTeamMembers);
teamRecordsRoutes.get("/summary", getTeamSummary);
teamRecordsRoutes.get("/members/:memberId/records", getTeamMemberRecords);

export default teamRecordsRoutes;
