# URL Shortener

A URL shortener service built with Node.js and PostgreSQL. It features data validation and analytics tracking

## Atomic Click

Increments link click using an inline atomic database update row query

## Indexed Read-Optimization:

 Link lookups hit highly optimized `UNIQUE` keys directly

### Prerequisites

`Node.js`

### Installation & Environment Setup

1. Clone or step into your active development directory:

   cd url-shortener

2. Spin up the underlying containerized PostgreSQL instance.

3. Install required runtime dependencies:

   npm install

### Execution

* Run the production server
  npm start

* Spin up the active development listener
  npm run dev

## ecurity Validation

validates system safety against SQL injections

Run the test using

npm test

### Verified Scenarios

1. Verifies that raw object payloads fail fast

2. Security Injection Regression Prevention

3. High-Stress Concurrency Assertion
