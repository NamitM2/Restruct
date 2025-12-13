-- Migration 006: Community Profiles System
-- Adds ratings, tags, downloads, icons, and analytics support

-- ============================================
-- CREATE NEW TABLES
-- ============================================

-- Profile tags table (predefined + custom tags)
CREATE TABLE IF NOT EXISTS profile_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL DEFAULT 'custom',
    is_predefined BOOLEAN DEFAULT false,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profile tag assignments (many-to-many)
CREATE TABLE IF NOT EXISTS profile_tag_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES routing_profiles(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES profile_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, tag_id)
);

-- Profile ratings (5-star system)
CREATE TABLE IF NOT EXISTS profile_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES routing_profiles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, user_id)
);

-- Profile downloads tracking
CREATE TABLE IF NOT EXISTS profile_downloads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL REFERENCES routing_profiles(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    downloaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ALTER EXISTING TABLES
-- ============================================

-- Add new columns to routing_profiles
ALTER TABLE routing_profiles ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'zap';
ALTER TABLE routing_profiles ADD COLUMN IF NOT EXISTS author_name TEXT;
ALTER TABLE routing_profiles ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0;
ALTER TABLE routing_profiles ADD COLUMN IF NOT EXISTS avg_rating DECIMAL(2,1) DEFAULT 0.0;
ALTER TABLE routing_profiles ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;

-- ============================================
-- INSERT PREDEFINED TAGS
-- ============================================

INSERT INTO profile_tags (name, category, is_predefined) VALUES
('Low Latency', 'performance', true),
('Real-time', 'performance', true),
('High Quality', 'performance', true),
('Budget', 'use-case', true),
('Code', 'use-case', true),
('Efficient', 'use-case', true),
('Creative', 'use-case', true),
('Research', 'use-case', true)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_profile_tags_category ON profile_tags(category);
CREATE INDEX IF NOT EXISTS idx_profile_tag_assignments_profile ON profile_tag_assignments(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_tag_assignments_tag ON profile_tag_assignments(tag_id);
CREATE INDEX IF NOT EXISTS idx_profile_ratings_profile ON profile_ratings(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_ratings_user ON profile_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_downloads_profile ON profile_downloads(profile_id);
CREATE INDEX IF NOT EXISTS idx_routing_profiles_published ON routing_profiles(published) WHERE published = true;
CREATE INDEX IF NOT EXISTS idx_routing_profiles_avg_rating ON routing_profiles(avg_rating DESC);
CREATE INDEX IF NOT EXISTS idx_routing_profiles_download_count ON routing_profiles(download_count DESC);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE profile_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_tag_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_downloads ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Profile Tags Policies
CREATE POLICY "Anyone can view tags" ON profile_tags FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create custom tags" ON profile_tags FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL AND is_predefined = false);

-- Profile Tag Assignments Policies
CREATE POLICY "Anyone can view public profile tags" ON profile_tag_assignments FOR SELECT USING (
    EXISTS (SELECT 1 FROM routing_profiles WHERE id = profile_id AND published = true)
);
CREATE POLICY "Profile owner can manage tags" ON profile_tag_assignments FOR ALL USING (
    EXISTS (SELECT 1 FROM routing_profiles WHERE id = profile_id AND user_id = auth.uid())
);

-- Profile Ratings Policies
CREATE POLICY "Anyone can view ratings" ON profile_ratings FOR SELECT USING (true);
CREATE POLICY "Authenticated users can rate" ON profile_ratings FOR INSERT
    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ratings" ON profile_ratings FOR UPDATE
    USING (auth.uid() = user_id);

-- Profile Downloads Policies
CREATE POLICY "Anyone can view download counts" ON profile_downloads FOR SELECT USING (true);
CREATE POLICY "Authenticated users can download" ON profile_downloads FOR INSERT
    WITH CHECK (auth.uid() = user_id);
