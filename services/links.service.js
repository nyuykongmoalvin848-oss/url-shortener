import {
    createLink,
    recordClickForCode,
    getLinkMetadataByCode,
    listClicksByLinkId,
    deleteLinkByCode,
} from "../repository/repo.js";
import { randomBytes } from "node:crypto";

function generateCode(length = 6) {
    const bytes = randomBytes(Math.ceil(length * 0.75));
    let code = bytes
        .toString("base64url")
        .replace(/[^A-Za-z0-9_-]/g, "");
    if (code.length < length) {
        code = randomBytes(length).toString("base64url").replace(/[^A-Za-z0-9_-]/g, "").slice(0, length);
    }
    return code.slice(0, length);
}

export async function createShortLink({ target_url, code, expires_at }) {
    const linkCode = code || generateCode(6);
    const link = await createLink({
        code: linkCode,
        target_url,
        expires_at: expires_at ?? null,
    });
    return link;
}

export async function recordShortLinkVisit(code, { referrer, userAgent } = {}) {
    return recordClickForCode(code, { referrer, userAgent });
}

export async function getShortLinkMetadata(code) {
    return getLinkMetadataByCode(code);
}

function encodeCursor({ clicked_at, id }) {
    const payload = JSON.stringify({
        clicked_at: clicked_at instanceof Date ? clicked_at.toISOString() : clicked_at,
        id,
    });
    return Buffer.from(payload).toString("base64url");
}

function decodeCursor(cursor) {
    try {
        const json = Buffer.from(cursor, "base64url").toString("utf8");
        return JSON.parse(json);
    } catch {
        return null;
    }
}

export async function getShortLinkClicks(code, { after, limit = 20 } = {}) {
    const link = await getLinkMetadataByCode(code);
    if (!link) {
        return { status: "not_found" };
    }

    let afterObj = null;
    if (after) {
        afterObj = decodeCursor(after);
        if (!afterObj || !afterObj.clicked_at || !afterObj.id) {
            return { status: "invalid_cursor" };
        }
    }

    const clicks = await listClicksByLinkId(link.id, { after: afterObj, limit });
    const next_cursor = clicks.length > 0
        ? encodeCursor({ clicked_at: clicks[clicks.length - 1].clicked_at, id: clicks[clicks.length - 1].id })
        : null;
    return { clicks, next_cursor };
}

export async function getShortLinkClickBatches(code) {
    const link = await getLinkMetadataByCode(code);
    if (!link) {
        return { status: "not_found" };
    }
    async function* batches() {
        const batchSize = 1000;
        let afterObj = null;
        while (true) {
            const batch = await listClicksByLinkId(link.id, { after: afterObj, limit: batchSize });
            if (batch.length === 0) break;
            yield batch;
            afterObj = { clicked_at: batch[batch.length - 1].clicked_at, id: batch[batch.length - 1].id };
        }
    }
    return { status: "ok", batches: batches() };
}

export async function deleteShortLink(code) {
    const result = await deleteLinkByCode(code);
    if (!result) return { status: "not_found" };
    return { status: "deleted" };
}
