# CampusPlug delivery outcomes

## 1. Real student accounts

- [ ] Students can create an account with email/password.
- [ ] Students can sign in and sign out through the website.
- [ ] The sign-in page supports Google sign-up/sign-in when the Google OAuth credentials are configured.
- [ ] The application uses a durable authenticated session and does not rely on the old localStorage-only sign-in preview.
- [ ] A signed-in user can have more than one role, including Student, Landlord / agent, and Vendor.

## 2. Durable student and marketplace data

- [ ] A managed database stores student profiles, roles, sessions, applications, accommodation listings, listing images, vendor products, product images, favorites, reports, and admin status changes.
- [ ] The application runs deterministic migrations and preserves data across restarts.
- [ ] Images are uploaded through an authorized server flow to durable project storage and their stable addresses are stored with the owning record.
- [ ] Demo records are clearly identified as examples and are not presented as real verified user submissions.

## 3. Accommodation discovery

- [ ] Students can search lodges by name, area, features, budget, availability, walking time, and sort order.
- [ ] Students can save and compare properties while signed in.
- [ ] Public listing cards show approval/verification status, availability date, owner context, price, location, walking time, images, facilities, and safety guidance.
- [ ] Students can submit an in-site enquiry or inspection request instead of relying on a custom WhatsApp message.

## 4. Landlord / agent applications and property publishing

- [ ] A landlord or agent can submit an application from the site with contact, coverage, and accommodation details.
- [ ] An approved landlord or agent can create and edit property listings with pricing, area, facilities, availability, description, and images.
- [ ] New or edited properties remain pending until the admin approves them.
- [ ] Only approved and published properties appear in the public search.

## 5. Vendor applications and products

- [ ] A vendor can submit a business application from the site with contact, category, location, and business details.
- [ ] An approved vendor can add, edit, unpublish, and manage product listings with price, stock, delivery/pickup information, and images.
- [ ] Vendor products remain hidden until the admin approves the vendor and the product.
- [ ] Students can browse published products and submit an in-site order/enquiry.

## 6. Admin workspace

- [ ] An admin can review, approve, reject, edit, publish, unpublish, and soft-hide landlord applications, vendor applications, properties, products, reports, and selected campus content.
- [ ] Admin screens show filters, status badges, ownership, timestamps, and the information needed to make a decision.
- [ ] Admin actions are protected server-side and cannot be performed by ordinary users by changing browser state.
- [ ] Admin can edit sample/content records and manage user role/status data.

## 7. Product quality and trust

- [ ] The existing CampusPlug visual direction is preserved and refined for responsive desktop and mobile layouts.
- [ ] Forms have validation, accessible labels, keyboard focus states, useful errors, and clear success messages.
- [ ] Public pages explain verification, availability, demo data, and safety practices without overstating guarantees.
- [ ] The route manifest is served at `/manus-routes.json` and stays aligned with the implemented pages.
