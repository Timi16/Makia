# E-Book Maker Backend

Production-ready backend for the E-Book Maker app built with Fastify, TypeScript, Prisma, PostgreSQL, Redis, BullMQ, AWS S3, JWT auth, Yjs realtime collaboration, Sharp image processing, Puppeteer PDF export, `epub-gen`, and Calibre CLI MOBI conversion.

## Requirements

- Node.js 20+
- Docker Desktop or Docker Engine with Compose
- AWS credentials with S3 access
- Calibre CLI available as `ebook-convert` or configured via `CALIBRE_EBOOK_CONVERT_BIN`
- Chromium available for Puppeteer, or set `PUPPETEER_EXECUTABLE_PATH`

## Run Locally

1. Copy `Backend/.env.example` to `Backend/.env` and fill in the secrets.
2. Start PostgreSQL and Redis:

   ```bash
   docker compose up -d postgres redis
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Generate the Prisma client:

   ```bash
   npm run prisma:generate
   ```

5. Run migrations against the admin connection:

   ```bash
   DATABASE_URL=$MIGRATION_DATABASE_URL npm run prisma:migrate
   ```

6. Start the API server:

   ```bash
   npm run dev
   ```

7. Start the export worker in a separate terminal:

   ```bash
   npm run worker:export
   ```

## Deployment

### PM2

Build the backend first:

```bash
npm run build
```

Run the API in cluster mode plus a dedicated export worker:

```bash
npm run pm2:start
```

Reload after deploying a new build:

```bash
npm run pm2:reload
```

Stop the managed processes:

```bash
npm run pm2:stop
```

### Nginx Load Balancing

- [deployment/nginx/nginx.conf](/Users/ik/Documents/Makia/Backend/deployment/nginx/nginx.conf) balances traffic across two API containers with `least_conn`.
- [docker-compose.deploy.yml](/Users/ik/Documents/Makia/Backend/docker-compose.deploy.yml) provides a simple deployment topology with:
  - `api-1`
  - `api-2`
  - `worker`
  - `nginx`
  - `postgres`
  - `redis`
- WebSocket upgrades are forwarded through Nginx.
- Realtime collaboration now uses Redis-backed pub/sub fan-out plus Redis-persisted Yjs room snapshots so multiple API nodes can share document updates and presence state.

## Environment Variables

`DATABASE_URL`
: Runtime PostgreSQL connection string. Use the non-superuser app role so row-level security is enforced.

`MIGRATION_DATABASE_URL`
: Admin PostgreSQL connection string used for Prisma migrations in local development.

`REDIS_URL`
: Redis connection string used by BullMQ and refresh-session storage.

`JWT_ACCESS_SECRET`
: Secret used to sign 15-minute access tokens.

`JWT_REFRESH_SECRET`
: Secret used to sign 7-day refresh tokens.

`AWS_REGION`
: AWS region for the S3 bucket.

`AWS_ACCESS_KEY_ID`
: Access key with permission to read and write upload and export objects.

`AWS_SECRET_ACCESS_KEY`
: Secret for the AWS access key.

`S3_BUCKET_NAME`
: Bucket that stores uploads, resized image variants, and exports.

`CLOUDFRONT_URL`
: Optional CloudFront distribution URL used to build CDN-facing asset URLs.

`PORT`
: Fastify server port. Defaults to `4000`.

`NODE_ENV`
: Application environment, typically `development` or `production`.

`FRONTEND_ORIGIN`
: Allowed frontend origin for CORS and cookie credentials.

`COOKIE_DOMAIN`
: Cookie domain for refresh tokens. Leave as `localhost` for local development.

`PUPPETEER_EXECUTABLE_PATH`
: Optional absolute path to a Chromium/Chrome binary for Puppeteer.

`CALIBRE_EBOOK_CONVERT_BIN`
: Optional path to the Calibre `ebook-convert` executable.

## Migrations

- Schema file: `src/prisma/schema.prisma`
- Generate client:

  ```bash
  npm run prisma:generate
  ```

- Apply local migrations:

  ```bash
  DATABASE_URL=$MIGRATION_DATABASE_URL npm run prisma:migrate
  ```

- Docker Compose provisions:
  - `postgres`: PostgreSQL 16
  - `redis`: Redis 7

## S3 Bucket Setup

- Keep "Block all public access" enabled.
- Configure bucket CORS to allow `PUT` from your frontend domain.
- Attach a CloudFront distribution if you want CDN-backed URLs.
- Grant the backend IAM credentials permission for `s3:GetObject`, `s3:PutObject`, and `s3:DeleteObject` as needed.
- Uploads are stored under user/book-specific prefixes.
- Resized image variants are written under the `resized/` prefix.
- Exported files are written under the `exports/` prefix.

## Notes

- `/health` returns `{ "status": "ok" }`.
- `/ready` checks PostgreSQL and Redis, and returns `503` if either dependency is unavailable.
- Refresh tokens are stored in an HTTP-only cookie.
- Refresh sessions are stored in Redis and rotated on `/api/auth/refresh`.
- Book, chapter, export, and asset tables use PostgreSQL row-level security with `app.current_user_id`.
- WebSocket collaboration is available at `/ws?bookId=...&name=...&userId=...`.
- WebSocket collaboration fans out across API instances through Redis pub/sub, which makes Nginx or PM2-backed multi-instance deployments workable for realtime sync.
- PM2 and Nginx are deployment options, not mandatory for a school submission.
