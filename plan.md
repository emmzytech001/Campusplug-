# CampusPlug implementation plan

## Product scope

CampusPlug will become a real UNIZIK student platform built from the uploaded prototype. The current accommodation-first experience, durable accounts, role applications, admin moderation, property/product publishing, campus updates, roommate listings, social links, and image storage remain the foundation.

The approved expansion is phased and additive: accommodation improvements; roommate matching and private connections; vendor dashboards; CampusPlug Lounge; private messaging; notifications; events and opportunities; and useful student tools. The current Manus/MySQL/Express architecture remains in place while each slice is implemented, tested, and reviewed. A later Supabase migration is not part of this implementation pass.

## Delivery phases

1. **Trust and marketplace foundation:** enrich accommodation search/details and owner context, add honest review/rating records, complete roommate request accept/decline and private connection states, and give approved vendors a real dashboard for product management.
2. **CampusPlug Lounge:** extend the moderated campus feed with categories, saved posts, replies, edit/delete-own-posts, reports, and latest/popular sorting.
3. **Private messaging and notifications:** add participant-only conversations, unread counts, message reporting/blocking, and an in-app notification centre for messages, roommate requests, post replies, enquiries, and important announcements.
4. **Events and opportunities:** add moderated event submissions, organiser details, dates, locations, registration links, and upcoming/past filtering.
5. **Student tools:** retain the budget planner, exam countdown, lodge checklist, and safety contacts while adding assignment/deadline reminders, academic resources, and campus survival tips.

## Implementation approach

- **Runtime:** Node.js + Express server, serving a responsive vanilla JavaScript frontend from `public/`.
- **Persistence:** Managed MySQL through `DATABASE_URL`, with deterministic additive SQL migrations in `migrations/` and the query layer in `src/db.js`.
- **Authentication:** Existing email/password sessions and Google OAuth remain the account boundary. No private contact details are exposed in public roommate cards.
- **Authorization:** Student, landlord/agent, vendor, and admin roles remain server-checked. Approval states gate public listings, vendor products, roommate profiles, posts, events, and messaging participants.
- **Images:** Existing authorized presigned uploads to Manus Storage remain the media path until a separately approved Supabase migration.
- **Admin workflows:** Each phase adds review/moderation controls rather than bypassing the existing admin queue.
- **Performance:** Public feeds and searches stay paginated/limited and use indexed status/owner columns; private records are queried only for authorized participants.

## Data model additions by phase

The existing tables remain unchanged unless an additive migration is required. Phase 1 adds property reviews and explicit roommate connection/request states. Later phases add Lounge saves/replies/reports, conversations/messages/notifications, and events/opportunities. Each migration is idempotent through the existing migration runner and preserves existing records.

## Project structure

```text
public/             # shell, visual system, responsive UI, routes and feature pages
src/server.js        # Express API, auth, authorization, moderation and storage uploads
src/db.js            # MySQL pool, migrations, query helpers and seed handling
src/auth.js          # password hashing, sessions and Google OAuth helpers
migrations/          # additive schema changes for each expansion phase
plan.md              # approved scope and design decisions
TODO.md              # outcome-based delivery tracking
```

## Design direction

The chosen design remains the warm neo-campus marketplace: contemporary community commerce with tactile cards, soft borders, practical dashboards, and a welcoming student-community tone. Existing CampusPlug colours, Bricolage Grotesque/DM Sans typography, rounded cards, burnt-orange actions, golden highlights, clear moderation states, and mobile-first layouts are preserved. New sections should feel like connected rooms in the same campus house rather than separate products.

## Trust and safety decisions

- Do not display private phone numbers or email addresses on public roommate profiles.
- Do not invent ratings, reviews, availability, conversations, or transactions.
- Student posts, roommate profiles, vendor products, listings, and events remain subject to the appropriate approval/moderation state.
- Private messages are visible only to conversation participants and authorized moderators where safety review requires it.
- Every new write path validates ownership/role server-side and uses the existing session boundary.
