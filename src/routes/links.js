import { Router } from 'express';
import crypto from 'crypto';
import { pool } from '../db.js';
import { createLinkSchema } from '../schemas.js';
import QueryStream from 'pg-query-stream';

export const router = Router();


const generateRandomCode = () => crypto.randomBytes(5).toString('hex'); // 10 alphanumeric chars


router.post('/links', async (req, res) => {
  try {
    const parsed = createLinkSchema.parse(req.body);
    const targetCode = parsed.code || generateRandomCode();
    const expiresAt = parsed.expires_at ? new Date(parsed.expires_at) : null;

    const queryText = `
      INSERT INTO links (code, target_url, expires_at)
      VALUES ($1, $2, $3)
      RETURNING id, code, target_url, expires_at, created_at, click_count
    `;
    
    const result = await pool.query(queryText, [targetCode, parsed.target_url, expiresAt]);
    return res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation failed', details: err.errors });
    }
    if (err.code === '23505') { 
      return res.status(409).json({ error: 'Code already taken' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/:code', async (req, res) => {
  const { code } = req.params;
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    
    const updateQuery = `
      UPDATE links 
      SET click_count = click_count + 1 
      WHERE code = $1 AND (expires_at IS NULL OR expires_at > now())
      RETURNING *
    `;
    const updateResult = await client.query(updateQuery, [code]);

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      

      const checkResult = await client.query('SELECT expires_at FROM links WHERE code = \$1', [code]);
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Unknown code' });
      }
      return res.status(410).json({ error: 'Expired' });
    }

    const link = updateResult.rows[0];
    const insertClickQuery = `
      INSERT INTO clicks (link_id, referrer, user_agent)
      VALUES ($1, $2, $3)
    `;
    await client.query(insertClickQuery, [link.id, req.get('referrer') || null, req.get('user-agent') || null]);
    
    await client.query('COMMIT');
    return res.redirect(302, link.target_url);
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});

