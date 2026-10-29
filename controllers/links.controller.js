
import {
    createLinkSchema,
    clickPaginationQuerySchema,
} from "../schemas/link.schema.js";
import {
    createShortLink,
    recordShortLinkVisit,
    getShortLinkMetadata,
    getShortLinkClicks,
    getShortLinkClickBatches,
    deleteShortLink,
} from "../services/links.service.js";

export async function createLinkController(req, res) {
    const parsed = createLinkSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({
            error: "Invalid request body",
            details: parsed.error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
            })),
        });
    }

    try {
        const link = await createShortLink(parsed.data);
        const baseUrl =
            process.env.BASE_URL ??
            `${req.protocol}://${req.get("host")}`;

        return res.status(201).json({
            ...link,
            short_url: `${baseUrl}/${link.code}`,
        });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                error: "That short code is already taken",
            });
        }

        console.error("Failed to create link:", error.message);

        return res.status(500).json({
            error: "Internal server error",
        });
    }
}

export async function getLinkClicksController(req, res) {
    const parsedQuery = clickPaginationQuerySchema.safeParse(req.query);

    if (!parsedQuery.success) {
        return res.status(400).json({
            error: "Invalid query parameters",
            details: parsedQuery.error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
            })),
        });
    }

    try {
        const result = await getShortLinkClicks(
            req.params.code,
            parsedQuery.data,
        );

        if (result.status === "not_found") {
            return res.status(404).json({
                error: "Short link not found",
            });
        }

        if (result.status === "invalid_cursor") {
            return res.status(400).json({
                error: "Invalid pagination cursor",
            });
        }

        return res.status(200).json({
            clicks: result.clicks,
            next_cursor: result.next_cursor,
        });
    } catch (error) {
        console.error("Failed to fetch click log:", error.message);

        return res.status(500).json({
            error: "Internal server error",
        });
    }
}

export async function getLinkMetadataController(req, res) {
    try {
        const link = await getShortLinkMetadata(req.params.code);

        if (!link) {
            return res.status(404).json({
                error: "Short link not found",
            });
        }

        return res.status(200).json(link);
    } catch (error) {
        console.error("Failed to fetch link metadata:", error.message);

        return res.status(500).json({
            error: "Internal server error",
        });
    }
}

export async function redirectLinkController(req, res) {
    try {
        const result = await recordShortLinkVisit(req.params.code, {
            referrer: req.get("referer"),
            userAgent: req.get("user-agent"),
        });

        if (result.status === "not_found") {
            return res.status(404).json({
                error: "Short link not found",
            });
        }

        if (result.status === "expired") {
            return res.status(410).json({
                error: "Short link has expired",
            });
        }

        return res.redirect(302, result.link.target_url);
    } catch (error) {
        console.error("Failed to redirect link:", error.message);

        return res.status(500).json({
            error: "Internal server error",
        });
    }
}


function escapeCsvField(value) {
    let text = value === null || value === undefined
        ? ""
        : String(value);

    // Prevent spreadsheet formula injection in untrusted text fields.
    if (/^[\t\r\n ]*[=+\-@]/.test(text)) {
        text = `'${text}`;
    }

    // CSV represents a quotation mark inside a field as two quotes.
    return `"${text.replace(/"/g, '""')}"`;
}

function writeCsvChunk(res, chunk) {
    if (res.destroyed) {
        return Promise.resolve(false);
    }

    if (res.write(chunk)) {
        return Promise.resolve(true);
    }

    // Wait for the response stream to be ready for more data.
    return new Promise((resolve) => {
        const cleanup = () => {
            res.off("drain", onDrain);
            res.off("close", onClose);
            res.off("error", onError);
        };

        const onDrain = () => {
            cleanup();
            resolve(true);
        };

        const onClose = () => {
            cleanup();
            resolve(false);
        };

        const onError = () => {
            cleanup();
            resolve(false);
        };

        res.once("drain", onDrain);
        res.once("close", onClose);
        res.once("error", onError);
    });
}


export async function exportClicksCsvController(req, res) {
    try {
        const result = await getShortLinkClickBatches(req.params.code);

        if (result.status === "not_found") {
            return res.status(404).json({
                error: "Short link not found",
            });
        }

        res.status(200);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
            "Content-Disposition",
            'attachment; filename="clicks.csv"',
        );
        res.setHeader("Cache-Control", "no-store");

        const header = "id,clicked_at,referrer,user_agent\r\n";

        if (!(await writeCsvChunk(res, header))) {
            return;
        }

        for await (const batch of result.batches) {
            for (const click of batch) {
                const row = [
                    click.id,
                    new Date(click.clicked_at).toISOString(),
                    click.referrer,
                    click.user_agent,
                ]
                    .map(escapeCsvField)
                    .join(",");

                if (!(await writeCsvChunk(res, `${row}\r\n`))) {
                    return;
                }
            }
        }

        if (!res.destroyed) {
            res.end();
        }
    } catch (error) {
        console.error("Failed to export click log:", error.message);

        if (res.headersSent) {
            res.destroy(error);
            return;
        }

        return res.status(500).json({
            error: "Internal server error",
        });
    }
}


export async function deleteLinkController(req, res) {
    try {
        const result = await deleteShortLink(req.params.code);

        if (result.status === "not_found") {
            return res.status(404).json({
                error: "Short link not found",
            });
        }

        return res.status(204).send();
    } catch (error) {
        console.error("Failed to delete link:", error.message);

        return res.status(500).json({
            error: "Internal server error",
        });
    }
}