# URL Shortener

A URL shortener service built with Node.js and PostgreSQL. It features data validation, analytics tracking, atomic click counting, keyset pagination, CSV export, and OpenAPI documentation.

## Ecosystem

- **Runtime:** Node.js (ES modules)
- **Web framework:** Express 5
- **Database:** PostgreSQL via `pg`
- **Validation:** Zod 4
- **API docs:** swagger-ui-express (OpenAPI 3 at `/docs`)
- **Testing:** Node.js built-in test runner (`node --test`)
- **CI:** GitHub Actions Super-Linter

## Features

- Create short links with optional custom codes and expiration
- Redirect with atomic click counting (concurrent-safe `FOR UPDATE` + increment)
- Link metadata retrieval
- Click analytics with keyset cursor pagination
- CSV export of click logs (streamed, injection-safe)
- Delete links (cascade deletes clicks)
- Health check endpoint
- OpenAPI spec served at `/docs/openapi.yaml`

## Prerequisites

- Node.js
- PostgreSQL

## Installation

1. Clone or step into the project directory:

   cd url-shortener

2. Create `src/controllers/.env` (see `.env.example`):

   cp src/controllers/.env.example src/controllers/.env

3. Provision the database via Docker Compose (applies schema and seed automatically):
   apply the schema:

   psql -U url_shortener_app -d url_shortener -f db/schema.sql
   psql -U url_shortener_app -d url_shortener -f db/seed.sql

4. Install dependencies:

   npm install

## Database Migrations & Seeds

- Schema: `db/schema.sql` (creates `links`, `clicks`, index)
- Seed data: `db/seed.sql` (inserts `welcome`, `project-docs` links)

Apply manually:

    psql -U url_shortener_app -d url_shortener -f db/schema.sql
    psql -U url_shortener_app -d url_shortener -f db/seed.sql

## Environment Variables

| Variable    | Description              | Default              |
| ----------- | ------------------------ | -------------------- |
| PORT        | HTTP listen port         | 3000                 |
| BASE_URL    | Base URL for short links | derived from request |
| DB_HOST     | PostgreSQL host          | localhost            |
| DB_PORT     | PostgreSQL port          | 5432                 |
| DB_NAME     | Database name            | url_shortener        |
| DB_USER     | Database user            | url_shortener_app    |
| DB_PASSWORD | Database password        | -                    |
| DB_POOL_MAX | Connection pool size     | 10                   |
| NODE_ENV    | Environment mode         | development          |

## Execution

- Run the production server: `npm start`
- Run the dev server : `npm run dev`
- Run tests: `npm test`

## API

Base path: `/links`

| Method | Path                    | Description             |
| ------ | ----------------------- | ----------------------- |
| POST   | /links                  | Create a short link     |
| GET    | /links/:code            | Get link metadata       |
| GET    | /links/:code/clicks     | List clicks (paginated) |
| GET    | /links/:code/clicks.csv | Export clicks as CSV    |
| DELETE | /links/:code            | Delete a link           |
| GET    | /:code                  | Redirect to target URL  |
| GET    | /health                 | Health check            |
| GET    | /docs                   | Swagger UI              |
| GET    | /docs/openapi.yaml      | OpenAPI spec            |

### CSV export

GET /links/:code/clicks.csv returns streamed CSV with columns `id,clicked_at,referrer,user_agent`.

## Data Model

See `db/schema.sql`. Tables: `links`, `clicks` (foreign key with cascade delete). Index `idx_clicks_link_id_clicked_at_id` for keyset pagination.

## Validation & Security

- Zod strict schemas reject unknown fields and malformed payloads
- Parameterized queries prevent SQL injection
- Atomic click updates via row-level locking
- CSV formula injection prevention
