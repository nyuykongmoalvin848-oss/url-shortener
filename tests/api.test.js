import 'dotenv/config'; // 👈 This automatically finds and loads your .env file
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import app from '../src/app.js';
import { pool } from '../src/db.js';

describe('URL Shortener Comprehensive Test Suite', () => {
  
  before(async () => {
    
    const fs = await import('node:fs');
    const path = await import('node:path');
    const schema = fs.readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
    await pool.query(schema);
    await pool.query('DELETE FROM links');
  });

  after(async () => {
    await pool.query('DELETE FROM links');
    await pool.query('DELETE FROM clicks');
    await pool.end();
  });

  test('Contract Lifecycle Execution Validation', async () => {
    
    const invalidRes = await fetch('http://localhost:3000/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_url: 'not-a-valid-url' })
    });
    assert.strictEqual(invalidRes.status, 400);

   
    const validRes = await fetch('http://localhost:3000/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_url: 'https://google.com', code: 'testlink' })
    });
    assert.strictEqual(validRes.status, 201);
    const body = await validRes.json();
    assert.strictEqual(body.code, 'testlink');
  });

  test('Security Regression: SQL Injection Attempt Protection', async () => {
    const injectionAttempt = "'; DROP TABLE links; --";
    const res = await fetch(`http://localhost:3000/${encodeURIComponent(injectionAttempt)}`);
    
    
    assert.strictEqual(res.status, 404);
    
    const tableVerification = await pool.query("SELECT to_regclass('public.links')");
    assert.notStrictEqual(tableVerification.rows[0].to_regclass, null);
  });

  test('Signature Feature: High Concurrency Atomic Increment Assertions', async () => {
   
    await pool.query("INSERT INTO links (code, target_url) VALUES ('burst', 'https://example.com')");
    
    
    const concurrencyCount = 50;
    const requests = Array.from({ length: concurrencyCount }, () => 
      fetch('http://localhost:3000/burst', { redirect: 'manual' })
    );

    await Promise.all(requests);

    
    const result = await pool.query("SELECT click_count FROM links WHERE code = 'burst'");
    assert.strictEqual(result.rows[0].click_count, concurrencyCount);
  });
});

test('404 Not Found for unknown code', async () => {
  const res = await fetch('http://localhost:3000/doesnotexist');
  assert.strictEqual(res.status, 404);
});

test('409 Conflict on duplicate code', async () => {
  await fetch('http://localhost:3000/links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_url: 'https://example.com', code: 'dupcode' }),
  });
  const res = await fetch('http://localhost:3000/links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_url: 'https://example.com', code: 'dupcode' }),
  });
  assert.strictEqual(res.status, 409);
});

test('410 Gone for expired link', async () => {
  const past = new Date(Date.now() - 1000).toISOString();
  await fetch('http://localhost:3000/links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_url: 'https://example.com', code: 'expiredcode', expires_at: past }),
  });
  const res = await fetch('http://localhost:3000/expiredcode', { redirect: 'manual' });
  assert.strictEqual(res.status, 410);
});

test('Keyset cursor pagination tracking', async () => {
  await fetch('http://localhost:3000/links', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_url: 'https://example.com', code: 'pagcode' }),
  });
  for (let i = 0; i < 3; i++) {
    await fetch('http://localhost:3000/pagcode', { redirect: 'manual' });
  }
  const res = await fetch('http://localhost:3000/pagcode/clicks?limit=2');
  const body = await res.json();
  assert.strictEqual(res.status, 200);
  assert.strictEqual(body.clicks.length, 2);
  assert.ok(body.next_cursor);
  const res2 = await fetch(`http://localhost:3000/pagcode/clicks?limit=2&after=${body.next_cursor}`);
  const body2 = await res2.json();
  assert.strictEqual(res2.status, 200);
  assert.strictEqual(body2.clicks.length, 1);
});
