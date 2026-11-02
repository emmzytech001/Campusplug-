CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  google_sub VARCHAR(190) NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  phone VARCHAR(40) NULL,
  avatar_url VARCHAR(500) NULL,
  roles_json TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  is_admin TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_sessions_expiry (expires_at)
);

CREATE TABLE IF NOT EXISTS auth_states (
  state_token CHAR(64) NOT NULL PRIMARY KEY,
  redirect_uri VARCHAR(500) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_auth_states_expiry (expires_at)
);

CREATE TABLE IF NOT EXISTS role_applications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  role_type VARCHAR(40) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  payload_json TEXT NOT NULL,
  admin_note TEXT NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_role_apps_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_role_apps_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_role_apps_status (role_type, status)
);

CREATE TABLE IF NOT EXISTS properties (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  owner_id BIGINT UNSIGNED NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  area VARCHAR(100) NOT NULL,
  price_year INT UNSIGNED NOT NULL,
  walk_minutes DECIMAL(5,1) NOT NULL DEFAULT 0,
  facilities_json TEXT NOT NULL,
  availability_status VARCHAR(32) NOT NULL DEFAULT 'available',
  availability_date DATE NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  published TINYINT(1) NOT NULL DEFAULT 0,
  verification_status VARCHAR(32) NOT NULL DEFAULT 'unverified',
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  admin_note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_properties_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_properties_public (published, status, area, price_year),
  INDEX idx_properties_owner (owner_id)
);

CREATE TABLE IF NOT EXISTS property_images (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  property_id BIGINT UNSIGNED NOT NULL,
  storage_key VARCHAR(500) NOT NULL,
  url VARCHAR(700) NOT NULL,
  alt_text VARCHAR(180) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_property_images_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  INDEX idx_property_images_property (property_id, sort_order)
);

CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  vendor_id BIGINT UNSIGNED NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  price INT UNSIGNED NOT NULL,
  stock_status VARCHAR(32) NOT NULL DEFAULT 'in_stock',
  delivery_info VARCHAR(240) NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  published TINYINT(1) NOT NULL DEFAULT 0,
  verification_status VARCHAR(32) NOT NULL DEFAULT 'unverified',
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  admin_note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_products_vendor FOREIGN KEY (vendor_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_products_public (published, status),
  INDEX idx_products_vendor (vendor_id)
);

CREATE TABLE IF NOT EXISTS product_images (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  storage_key VARCHAR(500) NOT NULL,
  url VARCHAR(700) NOT NULL,
  alt_text VARCHAR(180) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_images_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_product_images_product (product_id, sort_order)
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id BIGINT UNSIGNED NOT NULL,
  property_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, property_id),
  CONSTRAINT fk_favorites_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_favorites_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS enquiries (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  property_id BIGINT UNSIGNED NULL,
  product_id BIGINT UNSIGNED NULL,
  kind VARCHAR(32) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'new',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_enquiries_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_enquiries_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,
  CONSTRAINT fk_enquiries_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  INDEX idx_enquiries_status (status, created_at)
);

CREATE TABLE IF NOT EXISTS campus_posts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  author_id BIGINT UNSIGNED NULL,
  post_type VARCHAR(40) NOT NULL,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'published',
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_posts_author FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_posts_public (status, post_type)
);

CREATE TABLE IF NOT EXISTS reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  reporter_id BIGINT UNSIGNED NULL,
  property_id BIGINT UNSIGNED NULL,
  product_id BIGINT UNSIGNED NULL,
  reason VARCHAR(240) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  admin_note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL,
  CONSTRAINT fk_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_reports_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,
  CONSTRAINT fk_reports_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL,
  INDEX idx_reports_status (status, created_at)
);

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(120) NOT NULL PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO campus_posts (id, post_type, title, body, status, is_demo) VALUES
  (1, 'essential', 'Printing and photocopy', 'Sample shop in Ifite · open daily', 'published', 1),
  (2, 'essential', 'Laptop and phone repair', 'Sample stand in Amansea · Monday to Saturday', 'published', 1),
  (3, 'offer', 'Fan and power bank bundle', 'Sample exam-week offer from Gadget Hub', 'published', 1),
  (4, 'tool', 'Stay safe when renting', 'Check water, light, locks, roof, bathroom, written fees, and the walk home before you pay.', 'published', 1);

INSERT IGNORE INTO properties (id, title, description, area, price_year, walk_minutes, facilities_json, availability_status, status, published, verification_status, is_demo, admin_note) VALUES
  (1, 'Single room, self-contain', 'Sample listing for layout preview. Confirm the property and availability before any payment.', 'Ifite', 180000, 3, '["Tiled","Water","Prepaid meter"]', 'available', 'approved', 1, 'sample', 1, 'Demo record from the uploaded prototype'),
  (2, 'Room and parlour', 'Sample listing for layout preview. Confirm the property and availability before any payment.', 'Amansea', 260000, 8, '["Fenced","Water","Security"]', 'available', 'approved', 1, 'sample', 1, 'Demo record from the uploaded prototype'),
  (3, 'Shared room, 2 students', 'Sample listing for layout preview. Verify the roommate arrangement and rent terms in person.', 'Aroma', 90000, 12, '["Shared kitchen","Water"]', 'taken', 'approved', 1, 'sample', 1, 'Demo record from the uploaded prototype'),
  (4, 'Single room, shared bathroom', 'Sample listing for layout preview. Ask for a receipt and confirm shared-area rules.', 'Permanent Site', 120000, 5, '["Fenced","Prepaid meter"]', 'available', 'approved', 1, 'sample', 1, 'Demo record from the uploaded prototype');

INSERT IGNORE INTO products (id, title, description, price, stock_status, delivery_info, status, published, is_demo, admin_note) VALUES
  (1, 'Body lotion', 'Sample product profile for the vendor marketplace preview.', 4500, 'in_stock', 'Delivery or pickup · sample vendor', 'approved', 1, 1, 'Demo record from the uploaded prototype'),
  (2, 'Fast charger', 'Sample product profile for the vendor marketplace preview.', 6000, 'in_stock', 'Pickup point · sample vendor', 'approved', 1, 1, 'Demo record from the uploaded prototype'),
  (3, 'Laptop bag', 'Sample product profile for the vendor marketplace preview.', 12000, 'in_stock', 'Delivery or pickup · sample vendor', 'approved', 1, 1, 'Demo record from the uploaded prototype');
