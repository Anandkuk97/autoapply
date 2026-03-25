CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT,
  email TEXT UNIQUE,
  cv_text TEXT,
  cv_parsed_json JSONB,
  target_roles TEXT[],
  target_locations TEXT[],
  salary_min INTEGER,
  salary_max INTEGER,
  work_type TEXT,
  excluded_companies TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  company TEXT,
  role TEXT,
  location TEXT,
  salary TEXT,
  match_score INTEGER,
  status TEXT DEFAULT 'applied',
  tailored_cv TEXT,
  cover_letter TEXT,
  jd_text TEXT,
  applied_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  source_url TEXT
);

CREATE TABLE IF NOT EXISTS job_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  company TEXT,
  location TEXT,
  salary TEXT,
  description TEXT,
  source_url TEXT,
  scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
