-- Table to store processed URL results
CREATE TABLE IF NOT EXISTS url_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  url VARCHAR(2048) NOT NULL,
  hostname VARCHAR(255),
  title VARCHAR(1024),
  html_version VARCHAR(32),
  h1 INT DEFAULT 0,
  h2 INT DEFAULT 0,
  h3 INT DEFAULT 0,
  h4 INT DEFAULT 0,
  h5 INT DEFAULT 0,
  h6 INT DEFAULT 0,
  internal_links INT DEFAULT 0,
  external_links INT DEFAULT 0,
  inaccessible_links INT DEFAULT 0,
  has_login_form BOOLEAN DEFAULT FALSE,
  error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
