ALTER TABLE properties ADD COLUMN video_url VARCHAR(700) NULL;

CREATE TABLE IF NOT EXISTS roommate_listings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  area VARCHAR(100) NOT NULL,
  budget INT UNSIGNED NOT NULL,
  move_in_date DATE NULL,
  looking_for VARCHAR(120) NOT NULL,
  bio TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  published TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_roommate_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_roommates_public (published, status, area)
);

CREATE TABLE IF NOT EXISTS roommate_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  listing_id BIGINT UNSIGNED NOT NULL,
  requester_id BIGINT UNSIGNED NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'new',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_roommate_request_listing FOREIGN KEY (listing_id) REFERENCES roommate_listings(id) ON DELETE CASCADE,
  CONSTRAINT fk_roommate_request_user FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_roommate_requests_status (status, created_at)
);

INSERT IGNORE INTO app_settings (setting_key, setting_value) VALUES ('social_links_json', '[]');
