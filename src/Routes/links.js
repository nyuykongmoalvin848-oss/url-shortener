import { Router } from 'express';
import crypto from 'crypto';
import { pool } from '../db.js';
import { createLinkSchema } from '../schemas.js';
import QueryStream from 'pg-query-stream';

export const router = Router();


const generateRandomCode = () => crypto.randomBytes(5).toString('hex');


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


router.get('/links/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const result = await pool.query('SELECT * FROM links WHERE code = $1', [code]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Link not found' });
    return res.status(200).json(result.rows[0]);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/links/:code/clicks', async (req, res) => {
  const { code } = req.params;
  const limit = parseInt(req.query.limit, 10) || 20;
  const afterId = parseInt(req.query.after, 10) || 0;

  try {
    const linkCheck = await pool.query('SELECT id FROM links WHERE code = $1', [code]);
    if (linkCheck.rows.length === 0) return res.status(404).json({ error: 'Link not found' });
    
    const linkId = linkCheck.rows[0].id;
    const clickQuery = `
      SELECT id, clicked_at, referer, user_agent 
      FROM clicks 
      WHERE link_id = $1 AND id > $2
      ORDER BY id ASC
      LIMIT $3
    `;
    const clicks = await pool.query(clickQuery, [linkId, afterId, limit]);
    
    const nextCursor = clicks.rows.length > 0 ? clicks.rows[clicks.rows.length - 1].id : null;
    
    return res.status(200).json({
      clicks: clicks.rows,
      cursor: nextCursor
    });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/links/:code/clicks.csv', async (req, res) => {
  const { code } = req.params;
  const client = await pool.connect();
  
  try {
    const linkCheck = await client.query('SELECT id FROM links WHERE code = $1', [code]);
    if (linkCheck.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Link not found' });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="clicks_${code}.csv"`);
    res.write('id,clicked_at,referer,user_agent\n');

    const streamQuery = new QueryStream(
      'SELECT id, clicked_at, referer, user_agent FROM clicks WHERE link_id = $1 ORDER BY id ASC',
      [linkCheck.rows[0].id]
    );

    const stream = client.query(streamQuery);
    
    stream.on('data', (row) => {
      const escapedReferrer = row.referer ? `"${row.referer.replace(/"/g, '""')}"` : '';
      const escapedUA = row.user_agent ? `"${row.user_agent.replace(/"/g, '""')}"` : '';
      res.write(`${row.id},${row.clicked_at.toISOString()},${escapedReferrer},${escapedUA}\n`);
    });

    stream.on('end', () => {
      res.end();
      client.release();
    });

    stream.on('error', (err) => {
      res.end();
      client.release();
    });
  } catch (err) {
    client.release();
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  }
});


router.delete('/links/:code', async (req, res) => {
  const { code } = req.params;
  try {
    const result = await pool.query('DELETE FROM links WHERE code = $1 RETURNING id', [code]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Link not found' });
    return res.status(204).send();
  } catch (err) {
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
      

      const checkResult = await client.query('SELECT expires_at FROM links WHERE code = $1', [code]);
      if (checkResult.rows.length === 0) {
        return res.status(404).json({ error: 'Unknown code' });
      }
      return res.status(410).json({ error: 'Expired' });
    }

    const link = updateResult.rows[0];
    const insertClickQuery = `
      INSERT INTO clicks (link_id, referer, user_agent)
      VALUES ($1, $2, $3)
    `;
    await client.query(insertClickQuery, [link.id, req.get('referer') || null, req.get('user-agent') || null]);
    
    await client.query('COMMIT');
    return res.redirect(302, link.target_url);
  } catch (err) {
    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
});
