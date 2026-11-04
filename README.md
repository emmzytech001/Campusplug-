# CampusPlug

CampusPlug is a student accommodation, marketplace, roommate, and campus-news platform. It is designed for UNIZIK students and includes public discovery pages, email/Google authentication, partner applications, admin moderation, student news submissions, likes/comments, roommate listings, vendor products, lodge media, and practical student tools.

## Current architecture

The application is an Express server with a browser frontend in `public/`. Durable records are stored in MySQL through `mysql2`. Database migrations live in `migrations/` and run deterministically through `src/db.js`.

Authentication is application-managed. Email/password accounts are stored in the `users` table with bcrypt password hashes. Login sessions use opaque cookies; only a SHA-256 session-token hash is stored in the `sessions` table. Google sign-in uses OAuth and stores the Google subject identifier, not a Google password.

The current Manus deployment provides the managed MySQL connection and Manus storage integration. The Netlify adapter in `netlify.toml` and `netlify/functions/server.js` allows the same Express API to run as a Netlify Function, but Netlify still needs database, authentication, and storage environment values configured separately.

## Project structure

```text
.
├── app.config.ts              # Manus project logo metadata
├── Dockerfile                 # Container deployment definition
├── netlify.toml               # Netlify build, function, and redirect rules
├── netlify/functions/server.js# Netlify Functions Express adapter
├── package.json               # Scripts and runtime dependencies
├── pnpm-lock.yaml             # Locked dependency versions
├── pnpm-workspace.yaml        # pnpm lifecycle policy
├── migrations/                # Ordered MySQL schema/data migrations
│   ├── 001_initial.sql
│   ├── 002_community_features.sql
│   └── 003_news_interactions.sql
├── public/
│   ├── index.html              # Accessible application shell
│   ├── app.js                  # Client routing and UI behavior
│   ├── styles.css              # Main visual system
│   ├── theme.css               # Light/dark theme and community styles
│   ├── logo.svg                # CampusPlug house mark
│   └── manus-routes.json       # Managed route declaration
└── src/
    ├── server.js               # Express routes, API, moderation, auth flows
    ├── auth.js                 # Password hashing, sessions, roles, Google OAuth
    └── db.js                   # MySQL pool, migrations, JSON/media helpers
```

## Environment variables

Names only; never put real values in this README or commit them to Git.

### Database and runtime

- `DATABASE_URL`
- `DRIZZLE_DATABASE_URL`
- `PORT`
- `COOKIE_SECURE`
- `PUBLIC_APP_URL`

### Manus runtime and storage

- `MANUS_API_URL`
- `MANUS_API_KEY`

### Authentication and administration

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `ADMIN_EMAILS`

### Serverless runtime detection

- `NETLIFY`
- `AWS_LAMBDA_FUNCTION_NAME`

## Run locally

Requirements: Node.js 22 or compatible Node.js, pnpm, and a reachable MySQL database.

```bash
pnpm install
pnpm migrate
pnpm dev
```

The local server listens on `http://127.0.0.1:3000` unless `PORT` is set. Run the syntax checks with:

```bash
pnpm check
```

Do not commit `.env` files, database URLs, OAuth secrets, admin credentials, storage keys, or API tokens.

## Authentication and security status

Email sign-up currently does **not** send a verification email. There is currently no password-reset flow and no login rate limiting or account lockout. These should be added before a public launch if the platform will handle sensitive student accounts.

The admin role is checked on the server by `requireAdmin`. An account is considered admin when its `is_admin` database flag is true. `ADMIN_EMAILS` is also checked during email sign-up and Google account creation. In the current implementation, a person who can register the configured admin email before the real owner could receive the admin flag because email ownership is not verified. Set `ADMIN_EMAILS` only to an address you control and add email verification or an invite/bootstrap flow before launch.

Student and vendor/landlord permissions are also checked server-side. Vendor and landlord applications remain pending until an admin approves the related role.

## What depends on Manus

The database connection itself is supplied through `DATABASE_URL` or `DRIZZLE_DATABASE_URL`. If the application is moved to Netlify, a compatible externally reachable MySQL service must be configured there. The schema and migrations are portable MySQL, but the current database credentials and network access are not automatically exported to Netlify.

`MANUS_API_KEY` and `MANUS_API_URL` are used by `src/server.js` to request signed upload URLs for property and product images through Manus storage. They are also used to report whether storage is configured. The following behavior depends on that integration:

- Image upload from the lodge/property and product forms.
- Presigned upload URL creation at `/api/uploads/presign`.
- Storage paths under `/manus-storage/`.
- Durable image records that point to Manus storage keys and URLs.

Without a replacement storage provider, existing image URLs may stop working outside Manus and new image uploads will fail. A Netlify deployment needs a replacement such as S3-compatible storage, Cloudinary, Supabase Storage, or another object-storage service, followed by an adapter change in `presignStorage`.

The application logo currently references a Manus CDN asset in `app.config.ts`; copy that asset to an independent CDN before removing Manus completely. The rest of the normal API, authentication, database queries, migrations, frontend routes, and moderation logic do not require `MANUS_API_KEY`.

## Exporting and connecting to the database

The project can be migrated to another MySQL-compatible database by exporting the current database, importing it into the destination, setting `DATABASE_URL`, and running any pending migrations. Whether an outside connection is possible depends on the database provider's network policy, firewall, TLS settings, and credentials. The application code alone cannot make a private managed database externally reachable.

Before exporting production data, take a provider-level backup and treat the dump as sensitive because it contains student profiles, session records, applications, and potentially personal contact data. Do not put a database dump in GitHub.

## Demo records

The initial migration seeds these records with `is_demo=1`:

### Demo lodges

1. `Single room, self-contain` — Ifite — ₦180,000/year.
2. `Room and parlour` — Amansea — ₦260,000/year.
3. `Shared room, 2 students` — Aroma — ₦90,000/year — marked taken.
4. `Single room, shared bathroom` — Permanent Site — ₦120,000/year.

### Demo products

1. `Body lotion` — ₦4,500.
2. `Fast charger` — ₦6,000.
3. `Laptop bag` — ₦12,000.

### Demo campus posts

1. `Printing and photocopy` — sample shop in Ifite.
2. `Laptop and phone repair` — sample stand in Amansea.
3. `Fan and power bank bundle` — sample exam-week offer.
4. `Stay safe when renting` — sample rental safety checklist.

No roommate demo records are currently seeded. The database also contains the empty default social-links setting.

## Remove demo data before launch

Take a backup first. Run these statements against the intended production database after confirming that real records were not incorrectly marked as demo:

```sql
START TRANSACTION;
DELETE FROM products WHERE is_demo = 1;
DELETE FROM properties WHERE is_demo = 1;
DELETE FROM campus_posts WHERE is_demo = 1;
COMMIT;
```

Property images, product images, likes, and comments attached through foreign keys are removed automatically when their parent demo record is deleted. If a separate test account was created during development, remove only known test accounts, for example:

```sql
DELETE FROM users WHERE email LIKE 'campusplug-test-%@example.invalid';
```

Do not run a broad `DELETE FROM users` in production. Keep real student accounts, admin accounts, applications, and moderation history.

## Netlify deployment outline

1. Push this repository to GitHub.
2. In Netlify, choose **Add new site → Import an existing project → GitHub**.
3. Select the `main` branch of the CampusPlug repository.
4. Use the repository root as the base directory. Netlify reads `netlify.toml`, publishes `public`, and builds `netlify/functions/server.js`.
5. Add the environment variables listed above in Netlify site settings. Use a compatible external MySQL database and replacement object storage if leaving Manus storage.
6. Set the production `PUBLIC_APP_URL` to the final Netlify URL.
7. Add the exact Google OAuth callback URL: `https://YOUR_NETLIFY_DOMAIN/api/auth/google/callback`.
8. Run a deployment smoke test for sign-up, sign-in, admin denial, admin approval, database writes, lodge images, and Google OAuth before launch.

## Important pre-launch work

Before accepting real student accounts, add email verification, password reset, login rate limiting, admin invite/bootstrap protection, audit logging, CSRF protection where applicable, moderation/report workflows for all user-generated content, automated database backups, and an independent object-storage plan if Netlify will replace Manus storage.
