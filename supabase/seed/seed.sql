-- Seed data for The Security Watch
-- Run this after the migration to populate the database with sample data

-- Sample Institutions
INSERT INTO institutions (id, name, type, location, address, supervising_authority) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Lagos State Police Command', 'police', 'Lagos, Nigeria', 'Ikeja, Lagos State', 'Nigeria Police Force'),
  ('11111111-1111-1111-1111-111111111102', 'Lagos University Teaching Hospital', 'hospital', 'Lagos, Nigeria', 'Idi-Araba, Surulere, Lagos', 'Federal Ministry of Health'),
  ('11111111-1111-1111-1111-111111111103', 'University of Lagos', 'school', 'Lagos, Nigeria', 'Akoka, Yaba, Lagos', 'Federal Ministry of Education'),
  ('11111111-1111-1111-1111-111111111104', 'Balogun Market', 'market', 'Lagos, Nigeria', 'Lagos Island, Lagos', 'Lagos State Market Board'),
  ('11111111-1111-1111-1111-111111111105', 'Abuja Federal High Court', 'court', 'Abuja, Nigeria', 'Central District, Abuja', 'Federal Judiciary'),
  ('11111111-1111-1111-1111-111111111106', 'Federal Road Safety Corps - Lagos', 'government', 'Lagos, Nigeria', 'Ojodu Berger, Lagos', 'Federal Ministry of Works'),
  ('11111111-1111-1111-1111-111111111107', 'National Hospital Abuja', 'hospital', 'Abuja, Nigeria', 'Plot 132 Garki, Abuja', 'Federal Ministry of Health'),
  ('11111111-1111-1111-1111-111111111108', 'Kano State Police Command', 'police', 'Kano, Nigeria', 'Bompai Road, Kano', 'Nigeria Police Force'),
  ('11111111-1111-1111-1111-111111111109', 'Ogun State High Court', 'court', 'Abeokuta, Nigeria', 'Kobape Road, Abeokuta', 'Ogun State Judiciary'),
  ('11111111-1111-1111-1111-111111111110', 'Rivers State University', 'school', 'Port Harcourt, Nigeria', 'Nkpolu-Oroworukwo, Port Harcourt', 'Rivers State Government');

-- Note: User data should be created through the auth system.
-- The following are example queries for testing after users are registered:

-- Example: Create sample performance scores (run after institutions exist)
-- INSERT INTO performance_scores (institution_id, scorer_id, punctuality, professionalism, cleanliness, integrity, service_delivery, overall_score, comment)
-- VALUES ('11111111-1111-1111-1111-111111111101', '<user_id>', 3, 4, 2, 3, 3, 3.0, 'Average service delivery');
