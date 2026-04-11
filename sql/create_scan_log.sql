-- Run against your MySQL database (same DB as `DB_NAME`).
-- Audit log when an authenticated user scans a QR code.

CREATE TABLE IF NOT EXISTS scan_log (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  qr_code VARCHAR(512) NOT NULL,
  user_name VARCHAR(255) NOT NULL DEFAULT '',
  user_phone VARCHAR(64) NOT NULL DEFAULT '',
  user_role_id INT UNSIGNED NULL,
  user_role_name VARCHAR(255) NOT NULL DEFAULT '',
  scan_state VARCHAR(128) NULL,
  scan_district VARCHAR(128) NULL,
  scan_city VARCHAR(128) NULL,
  app_id INT UNSIGNED NOT NULL,
  scan_data JSON NULL,
  brand_id INT UNSIGNED NULL,
  longitude DECIMAL(10, 7) NULL,
  latitude DECIMAL(10, 7) NULL,
  product_id INT UNSIGNED NULL,
  product_name VARCHAR(512) NULL,
  category_id INT UNSIGNED NULL,
  sub_category_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_scan_log_user (user_id),
  KEY idx_scan_log_app (app_id),
  KEY idx_scan_log_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
