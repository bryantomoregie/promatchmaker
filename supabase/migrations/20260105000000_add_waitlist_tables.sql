-- Create waitlist_matchmakers table
-- This table stores matchmaker signups from the landing page
CREATE TABLE public.waitlist_matchmakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  organization VARCHAR(255),
  phone VARCHAR(50),
  how_heard VARCHAR(100),
  message TEXT,
  status VARCHAR(50) DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add comment for documentation
COMMENT ON TABLE public.waitlist_matchmakers IS 'Stores waitlist signups from matchmakers on the landing page';

-- Create index on email for performance
CREATE INDEX idx_waitlist_matchmakers_email ON public.waitlist_matchmakers(email);

-- Create index on status for filtering
CREATE INDEX idx_waitlist_matchmakers_status ON public.waitlist_matchmakers(status);

-- Create waitlist_referrals table
-- This table stores referrals where singles recommend matchmakers
CREATE TABLE public.waitlist_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  single_name VARCHAR(255) NOT NULL,
  single_email VARCHAR(255) NOT NULL,
  matchmaker_name VARCHAR(255),
  matchmaker_email VARCHAR(255) NOT NULL,
  message TEXT,
  status VARCHAR(50) DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT unique_referral UNIQUE (single_email, matchmaker_email)
);

-- Add comment for documentation
COMMENT ON TABLE public.waitlist_referrals IS 'Stores referrals where singles recommend matchmakers to join';

-- Create index on matchmaker_email for performance
CREATE INDEX idx_waitlist_referrals_matchmaker_email ON public.waitlist_referrals(matchmaker_email);

-- Create index on single_email for performance
CREATE INDEX idx_waitlist_referrals_single_email ON public.waitlist_referrals(single_email);

-- Create index on status for filtering
CREATE INDEX idx_waitlist_referrals_status ON public.waitlist_referrals(status);

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for waitlist_matchmakers
CREATE TRIGGER update_waitlist_matchmakers_updated_at
  BEFORE UPDATE ON public.waitlist_matchmakers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for waitlist_referrals
CREATE TRIGGER update_waitlist_referrals_updated_at
  BEFORE UPDATE ON public.waitlist_referrals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security on waitlist_matchmakers table
ALTER TABLE public.waitlist_matchmakers ENABLE ROW LEVEL SECURITY;

-- Enable Row Level Security on waitlist_referrals table
ALTER TABLE public.waitlist_referrals ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Allow anonymous users to INSERT into waitlist_matchmakers
CREATE POLICY "Anonymous users can insert waitlist signups"
  ON public.waitlist_matchmakers
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- RLS Policy: Only service role can SELECT from waitlist_matchmakers
CREATE POLICY "Service role can view waitlist signups"
  ON public.waitlist_matchmakers
  FOR SELECT
  TO service_role
  USING (true);

-- RLS Policy: Allow anonymous users to INSERT into waitlist_referrals
CREATE POLICY "Anonymous users can insert referrals"
  ON public.waitlist_referrals
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- RLS Policy: Only service role can SELECT from waitlist_referrals
CREATE POLICY "Service role can view referrals"
  ON public.waitlist_referrals
  FOR SELECT
  TO service_role
  USING (true);
