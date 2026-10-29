
import { Router } from "express";
import {
    createLinkController,
    getLinkMetadataController,
    getLinkClicksController,
    exportClicksCsvController,
    deleteLinkController,
} from "../controllers/links.controller.js";

const linksRouter = Router();

linksRouter.post("/", createLinkController);
linksRouter.get("/:code/clicks.csv", exportClicksCsvController);
linksRouter.get("/:code/clicks", getLinkClicksController);
linksRouter.delete("/:code", deleteLinkController);
linksRouter.get("/:code", getLinkMetadataController);

export default linksRouter;