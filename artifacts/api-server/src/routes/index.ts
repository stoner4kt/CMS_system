import { Router, type IRouter } from "express";
import healthRouter from "./health";
import siteStudioRouter from "./site-studio";

const router: IRouter = Router();

router.use(healthRouter);
router.use(siteStudioRouter);

export default router;
