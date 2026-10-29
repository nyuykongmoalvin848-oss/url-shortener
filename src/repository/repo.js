import { pool } from "../db.js";

export async function createLink({code, target_url, expires_at }) {
    const result = await pool.query(
        `INSERT INTO links (code, target_url,
        expires_at) VALUES ($1, $2, $3)
        RETURNING id, code, target_url, created_at, expires_at, click_count`,
        [code, target_url, expires_at ?? null],
    );

    return result.rows[0];

}


export async function recordClickForCode(
    code,
    { referrer, userAgent },
) {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        const linkResult = await client.query(
            `SELECT id, code, target_url, expires_at
            FROM links
            WHERE code = $1
            FOR UPDATE`,
            [code],
        );

        const link = linkResult.rows[0];

        if (!link) {
            await client.query("ROLLBACK");
            return { status: "not_found" };
        }

        const expiresAt = link.expires_at
            ? new Date(link.expires_at).getTime()
            : null;

        if (expiresAt !== null && expiresAt <= Date.now()) {
            await client.query("ROLLBACK");
            return { status: "expired" };
        }

        const counterResult = await client.query(
            `UPDATE links
            SET click_count = click_count + 1
            WHERE id = $1
            RETURNING click_count`,
            [link.id],
        );

        await client.query(
            `INSERT INTO clicks (link_id, referrer, user_agent)
            VALUES ($1, $2, $3)`,
            [link.id, referrer ?? null, userAgent ?? null],
        );

        await client.query("COMMIT");

        return {
            status: "found",
            link: {
                ...link,
                click_count: counterResult.rows[0].click_count,
            },
        };
    } catch (error) {
        try {
            await client.query("ROLLBACK");
        } catch (rollbackError) {
            console.error(
                "Click transaction rollback failed:",
                rollbackError.message,
            );
        }

        throw error;
    } finally {
        client.release();
    }
}

export async function getLinkMetadataByCode(code) {
    const result = await pool.query(
        `SELECT id, code, target_url, created_at, expires_at, click_count
        FROM links
        WHERE code = $1
        LIMIT 1`,
        [code],
    );

    return result.rows[0] ?? null;
}


export async function listClicksByLinkId(
    linkId,
    { after = null, limit },
) {
    let result;

    if (after) {
        result = await pool.query(
            `SELECT id, clicked_at, referrer, user_agent
            FROM clicks
            WHERE link_id = $1
                AND (clicked_at, id) <
                    ($2::timestamptz, $3::integer)
            ORDER BY clicked_at DESC, id DESC
            LIMIT $4`,
            [linkId, after.clicked_at, after.id, limit],
        );
    } else {
        result = await pool.query(
            `SELECT id, clicked_at, referrer, user_agent
            FROM clicks
            WHERE link_id = $1
            ORDER BY clicked_at DESC, id DESC
            LIMIT $2`,
            [linkId, limit],
        );
    }

    return result.rows;
}

export async function deleteLinkByCode(code) {
    const result = await pool.query(
        `DELETE FROM links
        WHERE code = $1
        RETURNING id, code`,
        [code],
    );

    return result.rows[0] ?? null;
}