import { Router } from "express";
import { getMyCredits } from "../controllers/my-credits.controller";
import { authMiddleware } from "../middleware/auth";

const myCreditsRoutes = Router();

myCreditsRoutes.use(authMiddleware);
myCreditsRoutes.get("/", getMyCredits);

export default myCreditsRoutes;
