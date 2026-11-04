# CampusPlug migration notes

This file documents what must be carried when moving CampusPlug away from Manus. It contains no secret values.

## Manus dependencies

### Manus managed database

The current application reads `DATABASE_URL` or `DRIZZLE_DATABASE_URL` from the Manus runtime. The MySQL schema is portable and is also provided in `schema.sql`, but the current database host, credentials, network access, backups, and production data are not exported by this repository.

To move the database, export the current MySQL database, import it into another reachable MySQL-compatible provider, set the destination `DATABASE_URL` or `DRIZZLE_DATABASE_URL`, and run pending migrations. Treat the export as sensitive because it contains student and authentication data.

### Manus storage and `MANUS_API_KEY`

`MANUS_API_KEY` and `MANUS_API_URL` are used in `src/server.js` by `presignStorage()` and the `/api/uploads/presign` route. They support:

- Uploading property/lodge images.
- Uploading product images.
- Requesting signed upload URLs.
- Returning `/manus-storage/...` paths for uploaded assets.
- Reporting storage availability in `/api/config`.

The database stores image metadata in `property_images` and `product_images`, including `storage_key` and `url`. The binary files are not stored in MySQL. A non-Manus deployment needs an object-storage replacement such as S3-compatible storage, Cloudinary, or another provider, plus a replacement for `presignStorage()` and the `/manus-storage/` URL strategy. Without that replacement, new image uploads fail and existing Manus storage URLs may stop working.

### Manus CDN logo

`app.config.ts` references a Manus CDN URL for the project logo. Copy `public/logo.svg` to an independent CDN or serve it from the deployed site before removing Manus completely. This is separate from user-uploaded property and product images.

### Manus project/runtime metadata

`public/manus-routes.json` is a Manus route declaration used by the managed web project. It is harmless as a static file outside Manus but is not a substitute for Netlify routing. `Dockerfile` and `netlify.toml` provide independent deployment paths.

## API routes

### Public and account routes

- `GET /api/health`
- `GET /api/config`
- `GET /api/me`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `GET /api/properties`
- `GET /api/products`
- `GET /api/posts`
- `GET /api/posts/:id/comments`
- `GET /api/social`
- `GET /api/roommates`
- `POST /api/posts`
- `POST /api/posts/:id/like`
- `POST /api/posts/:id/comments`
- `POST /api/properties`
- `POST /api/products`
- `POST /api/enquiries`
- `POST /api/favorites/:propertyId`
- `DELETE /api/favorites/:propertyId`
- `GET /api/saved`
- `GET /api/my/enquiries`
- `GET /api/my/properties`
- `GET /api/my/products`
- `POST /api/applications/:role`
- `POST /api/roommates`
- `POST /api/roommates/:id/requests`
- `POST /api/uploads/presign`

### Admin routes

- `GET /api/admin/overview`
- `GET /api/admin/applications`
- `PATCH /api/admin/applications/:id`
- `GET /api/admin/properties`
- `PATCH /api/admin/properties/:id`
- `POST /api/admin/properties`
- `GET /api/admin/products`
- `PATCH /api/admin/products/:id`
- `POST /api/admin/products`
- `GET /api/admin/enquiries`
- `GET /api/admin/posts`
- `POST /api/admin/posts`
- `PATCH /api/admin/posts/:id`
- `GET /api/admin/comments`
- `PATCH /api/admin/comments/:id`
- `PATCH /api/admin/reports/:id`
- `GET /api/admin/social`
- `PUT /api/admin/social`
- `GET /api/admin/roommates`
- `PATCH /api/admin/roommates/:id`

Admin routes use server-side `requireAdmin` checks. Student accounts must receive HTTP 403 for these routes.

## Admin account creation

The current implementation uses two mechanisms:

1. The database `users.is_admin` flag is checked by `requireAdmin`.
2. `ADMIN_EMAILS` is a comma-separated environment variable. Email sign-up and Google OAuth compare the normalized email against this list and set `is_admin` for a matching account. Existing accounts can also be promoted when the account is loaded through `ensureAdminByEmail()`.

This is not a safe final bootstrap design because email verification is not implemented. A person who registers the configured email before the legitimate owner could receive the admin flag. Before launch, replace this with verified email ownership, an invite-only admin bootstrap, or a one-time server-side admin creation command.

## Security gaps currently present

- Email sign-up does not require email verification.
- There is no password reset flow.
- There is no login rate limiting or account lockout.
- `ADMIN_EMAILS` can grant admin status during public registration before email ownership is verified.
- Passwords are bcrypt-hashed and are not stored in plain text.
- Sessions use HTTP-only cookies and store only a hash of the session token.
- Admin authorization is checked on the server, not just in the frontend.

These gaps should be addressed before accepting production student accounts.
