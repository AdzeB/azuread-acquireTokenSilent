-- Essential tables for reproduction
CREATE TYPE public.calendar_type AS ENUM ('outlook', 'google', 'apple');

CREATE TYPE public.outlook_account AS (
  account_id TEXT,
  username TEXT,
  name TEXT,
  environment TEXT,
  tenant_id TEXT,
  local_account_id TEXT,
  home_account_id TEXT,
  authority_type TEXT,
  tenant_profiles TEXT[],
  id_token_claims JSONB,
  id_token TEXT
);

CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  has_synced_calendar BOOLEAN DEFAULT FALSE
);

CREATE TABLE public.user_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  calendar_type public.calendar_type NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expiry TIMESTAMP WITH TIME ZONE,
  outlook_details public.outlook_account,
  scopes TEXT[],
  integration_email TEXT,
  UNIQUE(user_id, calendar_type)
);

CREATE TABLE public.msal_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cache_data JSONB NOT NULL,
  updated_at TIMESTAMPTZ,
  UNIQUE(user_id)
);