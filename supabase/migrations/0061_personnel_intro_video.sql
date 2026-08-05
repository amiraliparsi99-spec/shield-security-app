-- 0061_personnel_intro_video.sql
-- Guard intro videos: a short self-recorded clip ("hi, I'm X, here's my
-- background") that venues/agencies watch when deciding to hire. Video is
-- stored/transcoded by Mux; we keep only references + a moderation status.
--
-- status flow: none -> processing (upload created) -> pending (asset ready,
--   awaiting review) -> approved (visible to venues) | rejected
-- asset_id / playback_id come from Mux via webhook.

ALTER TABLE public.personnel
  ADD COLUMN IF NOT EXISTS intro_video_status      text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS intro_video_asset_id    text,
  ADD COLUMN IF NOT EXISTS intro_video_playback_id text,
  ADD COLUMN IF NOT EXISTS intro_video_uploaded_at timestamptz,
  ADD COLUMN IF NOT EXISTS intro_video_reviewed_at timestamptz;

COMMENT ON COLUMN public.personnel.intro_video_status IS
  'Intro video moderation state: none | processing | pending | approved | rejected. Only approved videos are shown to venues/agencies.';
COMMENT ON COLUMN public.personnel.intro_video_asset_id IS
  'Mux asset id for the intro video (server-managed).';
COMMENT ON COLUMN public.personnel.intro_video_playback_id IS
  'Mux playback id used to build the HLS stream + thumbnail URLs.';

-- Writes are performed server-side (upload route, Mux webhook, admin review)
-- with the service role, so no extra RLS is needed; existing SELECT policies
-- already let venues/agencies read personnel rows (and thus the playback id).
