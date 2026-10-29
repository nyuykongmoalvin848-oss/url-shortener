
import "dotenv/config";
import app from "./app.js";

const PORT = Number(process.env.PORT || 3000);

const server = app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

async function shutdown() {
    console.log("Shutting down server...");

    server.close(async () => {
        const { pool } = await import("./db.js");
        await pool.end();
        process.exit(0);
    });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);