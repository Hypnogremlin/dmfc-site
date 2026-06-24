-- Phase 2: Member enrollment tables
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gevdecxvpvopvdjjpaum/sql/new

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birthday DATE NOT NULL,
  usa_citizen BOOLEAN NOT NULL DEFAULT TRUE,
  sex_at_birth TEXT NOT NULL CHECK (sex_at_birth IN ('male', 'female', 'intersex', 'prefer_not_to_say')),
  gender_identity TEXT,
  weapon_classes TEXT[] NOT NULL DEFAULT '{}',
  shirt_size TEXT CHECK (shirt_size IN ('YXS', 'YS', 'YM', 'YL', 'YXL', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL')),
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  membership_season TEXT,
  enrollment_complete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE TABLE public.emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  contact_order INTEGER NOT NULL CHECK (contact_order IN (1, 2)),
  last_name TEXT NOT NULL,
  first_name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  email TEXT,
  email_2 TEXT,
  phone TEXT NOT NULL,
  phone_2 TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, contact_order)
);

ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own emergency contacts" ON public.emergency_contacts
  FOR ALL USING (
    auth.uid() = (SELECT id FROM public.profiles WHERE id = profile_id)
  );

CREATE TABLE public.member_medical (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  medical_conditions TEXT,
  preferred_medical_system TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id)
);

ALTER TABLE public.member_medical ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own medical info" ON public.member_medical
  FOR ALL USING (
    auth.uid() = (SELECT id FROM public.profiles WHERE id = profile_id)
  );

CREATE TABLE public.member_waivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  season_year TEXT NOT NULL,
  dmfc_rules_agreed BOOLEAN NOT NULL DEFAULT FALSE,
  dmfc_rules_signature TEXT,
  dmfc_rules_signed_at TIMESTAMPTZ,
  dmfc_rules_signer_type TEXT CHECK (dmfc_rules_signer_type IN ('athlete', 'guardian')),
  usa_fencing_agreed BOOLEAN NOT NULL DEFAULT FALSE,
  usa_fencing_signature TEXT,
  usa_fencing_signed_at TIMESTAMPTZ,
  usa_fencing_signer_type TEXT CHECK (usa_fencing_signer_type IN ('athlete', 'guardian')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, season_year)
);

ALTER TABLE public.member_waivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own waivers" ON public.member_waivers
  FOR ALL USING (
    auth.uid() = (SELECT id FROM public.profiles WHERE id = profile_id)
  );

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER medical_updated_at BEFORE UPDATE ON public.member_medical
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
