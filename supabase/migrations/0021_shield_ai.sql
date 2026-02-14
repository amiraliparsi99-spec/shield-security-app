-- Shield AI: Phase 1 RAG System with Phase 3 Data Collection
-- =====================================================================

-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- =====================================================================
-- 1. AI CONVERSATIONS - Training Data Collection
-- =====================================================================

CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  user_role TEXT NOT NULL, -- venue, agency, personnel
  session_id UUID NOT NULL, -- groups messages in a conversation
  
  -- The actual conversation
  message TEXT NOT NULL, -- user's question
  response TEXT NOT NULL, -- AI's response
  
  -- Context used (for improving RAG)
  context_used JSONB, -- which knowledge docs were retrieved
  model_used TEXT DEFAULT 'gpt-4o-mini',
  
  -- Feedback for training
  feedback_rating INTEGER CHECK (feedback_rating BETWEEN 1 AND 5),
  feedback_text TEXT,
  was_helpful BOOLEAN,
  
  -- Metadata
  tokens_used INTEGER,
  response_time_ms INTEGER,
  
  -- For Phase 3 training data export
  include_in_training BOOLEAN DEFAULT true,
  reviewed_for_training BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for analytics and training data export
CREATE INDEX idx_ai_conversations_user ON ai_conversations(user_id);
CREATE INDEX idx_ai_conversations_session ON ai_conversations(session_id);
CREATE INDEX idx_ai_conversations_training ON ai_conversations(include_in_training, reviewed_for_training);
CREATE INDEX idx_ai_conversations_created ON ai_conversations(created_at);

-- =====================================================================
-- 2. KNOWLEDGE BASE - Security Industry Documents
-- =====================================================================

CREATE TABLE IF NOT EXISTS ai_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Document info
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL, -- licensing, staffing, incidents, compliance, etc.
  subcategory TEXT,
  
  -- Source tracking
  source TEXT, -- 'SIA', 'internal', 'regulation', etc.
  source_url TEXT,
  source_date DATE,
  
  -- Vector embedding for semantic search
  embedding vector(1536), -- OpenAI ada-002 dimensions
  
  -- Metadata
  keywords TEXT[], -- for hybrid search
  applicable_roles TEXT[], -- which user roles this applies to
  priority INTEGER DEFAULT 5, -- 1-10, higher = more important
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_verified TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Vector similarity search index
CREATE INDEX idx_knowledge_embedding ON ai_knowledge_base 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_knowledge_category ON ai_knowledge_base(category);
CREATE INDEX idx_knowledge_active ON ai_knowledge_base(is_active);

-- =====================================================================
-- 3. AI SUGGESTIONS - Proactive Insights
-- =====================================================================

CREATE TABLE IF NOT EXISTS ai_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Suggestion details
  suggestion_type TEXT NOT NULL, -- staffing, compliance, risk, optimization
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  action_url TEXT, -- deep link to relevant feature
  
  -- Priority and timing
  priority TEXT DEFAULT 'medium', -- low, medium, high, urgent
  valid_until TIMESTAMPTZ,
  
  -- Tracking
  is_read BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  is_actioned BOOLEAN DEFAULT false,
  actioned_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_ai_suggestions_user ON ai_suggestions(user_id, is_dismissed);

-- =====================================================================
-- 4. AI ANALYTICS - Usage Tracking
-- =====================================================================

CREATE TABLE IF NOT EXISTS ai_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- What was asked
  query_category TEXT NOT NULL, -- staffing, licensing, incidents, etc.
  query_intent TEXT, -- question, how-to, troubleshoot, etc.
  
  -- Aggregated stats (daily)
  date DATE NOT NULL,
  user_role TEXT NOT NULL,
  
  query_count INTEGER DEFAULT 1,
  avg_rating DECIMAL(3,2),
  helpful_count INTEGER DEFAULT 0,
  not_helpful_count INTEGER DEFAULT 0,
  
  UNIQUE(date, query_category, user_role)
);

CREATE INDEX idx_ai_analytics_date ON ai_analytics(date);

-- =====================================================================
-- 5. COMMON QUESTIONS - FAQ Builder
-- =====================================================================

CREATE TABLE IF NOT EXISTS ai_common_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  question TEXT NOT NULL,
  normalized_question TEXT NOT NULL, -- lowercase, cleaned
  
  -- Best answer (curated)
  curated_answer TEXT,
  auto_generated_answer TEXT,
  
  -- Stats
  ask_count INTEGER DEFAULT 1,
  last_asked TIMESTAMPTZ DEFAULT now(),
  avg_rating DECIMAL(3,2),
  
  -- Curation
  is_curated BOOLEAN DEFAULT false,
  curated_by UUID,
  curated_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_common_questions_normalized ON ai_common_questions(normalized_question);
CREATE INDEX idx_common_questions_count ON ai_common_questions(ask_count DESC);

-- =====================================================================
-- 6. RLS POLICIES
-- =====================================================================

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_common_questions ENABLE ROW LEVEL SECURITY;

-- Conversations: users see their own
CREATE POLICY "Users can view own conversations" ON ai_conversations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations" ON ai_conversations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations" ON ai_conversations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Knowledge base: everyone can read
CREATE POLICY "Anyone can read knowledge base" ON ai_knowledge_base
  FOR SELECT TO authenticated USING (is_active = true);

-- Suggestions: users see their own
CREATE POLICY "Users can view own suggestions" ON ai_suggestions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update own suggestions" ON ai_suggestions
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Analytics: read only for now
CREATE POLICY "Authenticated can read analytics" ON ai_analytics
  FOR SELECT TO authenticated USING (true);

-- Common questions: everyone can read
CREATE POLICY "Anyone can read common questions" ON ai_common_questions
  FOR SELECT TO authenticated USING (true);

-- =====================================================================
-- 7. FUNCTIONS
-- =====================================================================

-- Function to search knowledge base by similarity
CREATE OR REPLACE FUNCTION search_knowledge_base(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  filter_category text DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content TEXT,
  category TEXT,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    kb.id,
    kb.title,
    kb.content,
    kb.category,
    1 - (kb.embedding <=> query_embedding) as similarity
  FROM ai_knowledge_base kb
  WHERE kb.is_active = true
    AND (filter_category IS NULL OR kb.category = filter_category)
    AND 1 - (kb.embedding <=> query_embedding) > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to track common questions
CREATE OR REPLACE FUNCTION track_ai_question(
  question_text TEXT,
  generated_answer TEXT
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  normalized TEXT;
  question_id UUID;
BEGIN
  -- Normalize the question
  normalized := lower(trim(regexp_replace(question_text, '[^a-zA-Z0-9\s]', '', 'g')));
  
  -- Try to find existing question
  SELECT id INTO question_id
  FROM ai_common_questions
  WHERE normalized_question = normalized;
  
  IF question_id IS NOT NULL THEN
    -- Update existing
    UPDATE ai_common_questions
    SET ask_count = ask_count + 1,
        last_asked = now(),
        auto_generated_answer = generated_answer
    WHERE id = question_id;
  ELSE
    -- Insert new
    INSERT INTO ai_common_questions (question, normalized_question, auto_generated_answer)
    VALUES (question_text, normalized, generated_answer)
    RETURNING id INTO question_id;
  END IF;
  
  RETURN question_id;
END;
$$;

-- Function to get AI stats for dashboard
CREATE OR REPLACE FUNCTION get_ai_stats(days_back INTEGER DEFAULT 30)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_conversations', (
      SELECT COUNT(*) FROM ai_conversations 
      WHERE created_at > now() - (days_back || ' days')::interval
    ),
    'avg_rating', (
      SELECT ROUND(AVG(feedback_rating)::numeric, 2) FROM ai_conversations 
      WHERE feedback_rating IS NOT NULL 
      AND created_at > now() - (days_back || ' days')::interval
    ),
    'helpful_rate', (
      SELECT ROUND(
        (COUNT(*) FILTER (WHERE was_helpful = true)::numeric / 
         NULLIF(COUNT(*) FILTER (WHERE was_helpful IS NOT NULL), 0) * 100)::numeric, 1
      )
      FROM ai_conversations 
      WHERE created_at > now() - (days_back || ' days')::interval
    ),
    'top_categories', (
      SELECT json_agg(row_to_json(t))
      FROM (
        SELECT query_category, SUM(query_count) as count
        FROM ai_analytics
        WHERE date > now() - (days_back || ' days')::interval
        GROUP BY query_category
        ORDER BY count DESC
        LIMIT 5
      ) t
    ),
    'conversations_by_role', (
      SELECT json_object_agg(user_role, cnt)
      FROM (
        SELECT user_role, COUNT(*) as cnt
        FROM ai_conversations
        WHERE created_at > now() - (days_back || ' days')::interval
        GROUP BY user_role
      ) t
    )
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_ai_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_ai_knowledge_base_updated_at ON ai_knowledge_base;
CREATE TRIGGER update_ai_knowledge_base_updated_at
  BEFORE UPDATE ON ai_knowledge_base
  FOR EACH ROW EXECUTE FUNCTION update_ai_updated_at();
