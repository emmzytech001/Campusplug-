ALTER TABLE properties ADD COLUMN room_type VARCHAR(80) NOT NULL DEFAULT 'room' AFTER title;

CREATE TABLE IF NOT EXISTS property_reviews (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  property_id BIGINT UNSIGNED NOT NULL,
  reviewer_id BIGINT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  body TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  admin_note TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_property_reviews_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  CONSTRAINT fk_property_reviews_reviewer FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_property_review_reviewer (property_id, reviewer_id),
  INDEX idx_property_reviews_public (property_id, status, created_at)
);

CREATE TABLE IF NOT EXISTS roommate_connections (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  request_id BIGINT UNSIGNED NOT NULL,
  listing_id BIGINT UNSIGNED NOT NULL,
  requester_id BIGINT UNSIGNED NOT NULL,
  owner_id BIGINT UNSIGNED NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_roommate_connection_request FOREIGN KEY (request_id) REFERENCES roommate_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_roommate_connection_listing FOREIGN KEY (listing_id) REFERENCES roommate_listings(id) ON DELETE CASCADE,
  CONSTRAINT fk_roommate_connection_requester FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_roommate_connection_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_roommate_connection_request (request_id),
  INDEX idx_roommate_connections_users (requester_id, owner_id, status)
);
