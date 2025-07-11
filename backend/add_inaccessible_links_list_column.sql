-- Add a new column to store the inaccessible links list as JSON
ALTER TABLE url_results ADD COLUMN inaccessible_links_list TEXT DEFAULT NULL;
