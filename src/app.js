import "dotenv/config";
import { readFileSync } from "node:fs";
import express from "express";
import swaggerUi from "swagger-ui-express";
import { pool } from "./db.js";
import linksRouter from "../routes/links.routes.js";
import { redirectLinkController } from "../controllers/links.controller.js";

const app = express();

const openApiYaml = readFileSync(
    new URL("../docs/openapi.yaml", import.meta.url),
    "utf8",
);

app.use(express.json());

app.get("/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");

        return res.status(200).json({
            status: "ok",
            database: "connected",
        });
    } catch (error) {
        console.error("Health check failed:", error.message);

        return res.status(503).json({
            status: "error",
            database: "unavailable",
        });
    }
});

app.get("/docs/openapi.yaml", (req, res) => {
    return res.type("text/yaml").send(openApiYaml);
});

app.use(
    "/docs",
    swaggerUi.serve,
    swaggerUi.setup(null, {
        swaggerOptions: {
            url: "/docs/openapi.yaml",
        },
    }),
);

app.use("/links", linksRouter);

app.get("/:code", redirectLinkController);

export default app;