# CampusPlug implementation plan

## Product scope

CampusPlug will become a real UNIZIK student platform built from the uploaded prototype. The first production-oriented slice keeps the existing accommodation-first experience while adding durable accounts, role applications, admin moderation, property/product publishing, and image storage. WhatsApp-only application flows will be replaced with in-site submissions; WhatsApp may remain as an optional contact channel for public enquiries, but it will not be the approval or account system.

## Implementation approach

- **Runtime:** Node.js + Express server, serving a responsive vanilla JavaScript frontend from `public/`.
- **Persistence:** Managed MySQL through `DATABASE_URL`, with deterministic SQL migrations in `migrations/` and a small query/repository layer in `src/db.js`.
- **Authentication:** Email/password accounts with bcrypt hashes and database-backed opaque sessions. Google OAuth 2.0 is wired through `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`; the UI shows a clear setup state until those protected values are configured. Sessions use the required `webdev_app_session` cookie with `SameSite=None; Secure` for embedded HTTPS Preview.
- **Authorization:** Student, landlord/agent, vendor, and admin roles. Role applications are stored and reviewed. Only approved admin records can publish properties/products. Admin access is controlled by `ADMIN_EMAILS`.
- **Images:** Server-authorized presigned uploads to Manus Storage, with stable `/manus-storage/...` URLs persisted in the database and linked to properties/products.
- **Admin workflows:** Admin dashboard tabs for applications, properties, products, reports, users, and content. Actions include approve, reject, publish/unpublish, edit, and soft-delete/hide.
- **Seed data:** The prototype's sample lodges, campus services, vendors, and deals are migrated as clearly marked demo records. Real user-created data is separated with `is_demo` flags.
- **Public experience:** Search, budget/distance filters, saved properties, property detail cards, roommate and campus content sections, and clear verification/availability language.

## Data model

Core tables: `users`, `sessions`, `role_applications`, `properties`, `property_images`, `products`, `product_images`, `favorites`, `campus_posts`, `reports`, and `app_settings`. Every mutable record carries status and timestamps. Ownership is enforced server-side; admin actions are audited through `admin_notes` and status metadata.

## Project structure

```text
public/
  index.html       # shell and accessible page regions
  styles.css       # CampusPlug visual system and responsive layout
  app.js           # browser state, API calls, routing, forms, and rendering
  manus-routes.json
src/
  server.js        # Express app, routes, auth, admin actions, storage upload proxy
  db.js            # MySQL pool, migrations, seed data, query helpers
  auth.js          # password hashing, sessions, Google OAuth helpers
migrations/
  001_initial.sql  # idempotent schema and indexes
plan.md
TODO.md
package.json
.env.example
Dockerfile
app.config.ts
```

## Design direction

### Alternatives considered

- Probability 0.06 — Quiet editorial campus guide with restrained typography and photo-led storytelling.
- Probability 0.05 — Bright utility marketplace with playful iconography and dense dashboard controls.
- Probability 0.04 — **Chosen: warm neo-campus marketplace**, combining practical product utility with a welcoming student-community tone.

### Chosen design system

- **Design Movement:** Warm neo-campus marketplace: contemporary community commerce with tactile cards, soft borders, and confident editorial type.
- **Core Principles:** Trust before conversion; one clear next action per card; student-friendly language; admin clarity without visual clutter.
- **Color Philosophy:** Cream and cocoa create familiarity and place; burnt orange is the action and verification color; golden yellow is a sparing confidence accent.
- **Layout Paradigm:** A wide, left-anchored content rail with a compact sticky header, editorial hero/search band, and asymmetric card density rather than a generic centered dashboard grid.
- **Signature Elements:** CampusPlug house-mark, rounded warm-surface cards, and orange/yellow status pills that make approval and availability legible.
- **Interaction Philosophy:** Every action explains what happens next. Approval states are explicit, empty states teach the workflow, and destructive actions require a confirm step.
- **Animation:** Small hover lifts and opacity transitions only; respect reduced-motion preferences and avoid motion that competes with forms or moderation controls.
- **Typography System:** Bricolage Grotesque for brand and headings; DM Sans for controls and body copy; strong numeric prices and restrained metadata hierarchy.
- **Brand Essence:** A trustworthy student marketplace for finding a better place to live and plug into campus life. Personality: warm, practical, protective.
- **Brand Voice:** Headlines are direct and optimistic; CTAs name the outcome. Example lines: “Find a place that fits campus life.” and “Review once, publish with confidence.”
- **Wordmark & Logo:** Preserve the yellow house-mark from the supplied prototype beside the CampusPlug wordmark.
- **Signature Brand Color:** Burnt orange `#A94412`.

## Additional improvements included

- Explicit demo-data labels so sample records are not mistaken for verified listings.
- Admin audit context and soft-delete states instead of hard deletion for moderation safety.
- Role-aware empty states, approval timelines, and onboarding guidance.
- Accessible form labels, keyboard focus states, responsive mobile navigation, and mobile-friendly admin tables.
