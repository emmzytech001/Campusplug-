ALTER TABLE users ADD COLUMN bio VARCHAR(500) NULL AFTER avatar_url;
ALTER TABLE users ADD COLUMN department VARCHAR(160) NULL AFTER bio;
ALTER TABLE users ADD COLUMN level VARCHAR(40) NULL AFTER department;
ALTER TABLE users ADD COLUMN preferred_area VARCHAR(100) NULL AFTER level;
ALTER TABLE users ADD COLUMN roommate_preferences VARCHAR(500) NULL AFTER preferred_area;
ALTER TABLE users ADD COLUMN profile_visibility VARCHAR(20) NOT NULL DEFAULT 'public' AFTER roommate_preferences;
