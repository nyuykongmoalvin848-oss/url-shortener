import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { app } from '../src/app.js';
import { pool } from '../src/db.js';

describe('URL Shortener Comprehensive Test Suite', () => {
  
  before(async () => {
    
    await pool.query('DELETE FROM links');
  });

  after(async () => {
    
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
