import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new pg.Pool({
    connectingString: process.env.DATABASE_URL,
});

export const query = (text, params) => pool.query(text, params);