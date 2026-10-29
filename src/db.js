
import pg from "pg";
import "dotenv/config";

const { Pool } = pg;

export const pool = new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: Number(process.env.DB_POOL_MAX || 10),
});

pool.on("error", (error) => {
    console.error("Unexpected PostgreSQL pool error:", error.message);
});