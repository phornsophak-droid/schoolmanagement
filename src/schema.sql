-- -*- mode: sql; sql-product: postgres; -*-
-- ==============================================================================
-- Supabase Database Schema setup
-- សាលាសហគមន៍ច្បារច្រុះ (Chbar Chroh Community School) — System DB
-- ==============================================================================

-- Enable requisite extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. TABLE FOR STUDENT SCORES (កំណត់ត្រាពិន្ទុសិស្សប្រចាំខែនីមួយៗ)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('ប្រុស', 'ស្រី')),
    grade VARCHAR(50) NOT NULL,       -- ថ្នាក់ទី១ ដល់ ថ្នាក់ទី៦
    month VARCHAR(50) NOT NULL,       -- ខែសិក្សា (មករា, កុម្ភៈ, មិនា, ...)
    
    -- Khmer Score breakdown (ភាសាខ្មែរ ៤ ផ្នែករង)
    khmer_listening NUMERIC(4,2) DEFAULT 0.00 CHECK (khmer_listening BETWEEN 0 AND 10),
    khmer_writing NUMERIC(4,2) DEFAULT 0.00 CHECK (khmer_writing BETWEEN 0 AND 10),
    khmer_reading NUMERIC(4,2) DEFAULT 0.00 CHECK (khmer_reading BETWEEN 0 AND 10),
    khmer_speaking NUMERIC(4,2) DEFAULT 0.00 CHECK (khmer_speaking BETWEEN 0 AND 10),
    
    -- Math Score breakdown (គណិតវិទ្យា ៥ ផ្នែករង)
    math_numbers NUMERIC(4,2) DEFAULT 0.00 CHECK (math_numbers BETWEEN 0 AND 10),
    math_measurement NUMERIC(4,2) DEFAULT 0.00 CHECK (math_measurement BETWEEN 0 AND 10),
    math_geometry NUMERIC(4,2) DEFAULT 0.00 CHECK (math_geometry BETWEEN 0 AND 10),
    math_algebra NUMERIC(4,2) DEFAULT 0.00 CHECK (math_algebra BETWEEN 0 AND 10),
    math_statistics NUMERIC(4,2) DEFAULT 0.00 CHECK (math_statistics BETWEEN 0 AND 10),
    
    -- Other Secondary Subjects (មុខវិជ្ជាបន្ទាប់បន្សំ)
    science NUMERIC(4,2) DEFAULT 0.00 CHECK (science BETWEEN 0 AND 10),
    social_studies NUMERIC(4,2) DEFAULT 0.00 CHECK (social_studies BETWEEN 0 AND 10),
    physical_education NUMERIC(4,2) DEFAULT 0.00 CHECK (physical_education BETWEEN 0 AND 10),
    health NUMERIC(4,2) DEFAULT 0.00 CHECK (health BETWEEN 0 AND 10),
    life_skills NUMERIC(4,2) DEFAULT 0.00 CHECK (life_skills BETWEEN 0 AND 10),
    foreign_language NUMERIC(4,2) DEFAULT 0.00 CHECK (foreign_language BETWEEN 0 AND 10),
    
    -- Cached computed aggregates for instantaneous client-side metrics and server-side reports
    khmer_avg NUMERIC(4,2) DEFAULT 0.00,
    math_avg NUMERIC(4,2) DEFAULT 0.00,
    overall_avg NUMERIC(4,2) DEFAULT 0.00,
    grade_letter VARCHAR(5) DEFAULT 'F',
    result VARCHAR(10) NOT NULL CHECK (result IN ('ជាប់', 'ធ្លាក់')),
    ranking INTEGER DEFAULT NULL,
    
    -- Meta audit timelines
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Optimize queries for gradebook filters, ranking matrices and monthly summaries
CREATE INDEX IF NOT EXISTS idx_student_scores_grade_month ON public.student_scores(grade, month);
CREATE INDEX IF NOT EXISTS idx_student_scores_overall_avg ON public.student_scores(overall_avg DESC);
CREATE INDEX IF NOT EXISTS idx_student_scores_name ON public.student_scores(name);

-- ------------------------------------------------------------------------------
-- 2. TABLE FOR SCHOOL REPORTS (របាយការណ៍សរុបប្រចាំខែរបស់សាលា)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_name VARCHAR(255) NOT NULL,
    grade VARCHAR(50) NOT NULL,
    month VARCHAR(50) NOT NULL,
    academic_year VARCHAR(50) NOT NULL,
    
    -- Basic Enrollment Statistics (ស្ថិតិសិស្សានុសិស្សទូទៅ)
    start_year_total INTEGER DEFAULT 0 CHECK (start_year_total >= 0),
    start_year_female INTEGER DEFAULT 0 CHECK (start_year_female >= 0),
    current_total INTEGER DEFAULT 0 CHECK (current_total >= 0),
    current_female INTEGER DEFAULT 0 CHECK (current_female >= 0),
    dropout_total INTEGER DEFAULT 0 CHECK (dropout_total >= 0),
    dropout_female INTEGER DEFAULT 0 CHECK (dropout_female >= 0),
    absent_total INTEGER DEFAULT 0 CHECK (absent_total >= 0),
    absent_female INTEGER DEFAULT 0 CHECK (absent_female >= 0),
    passed_total INTEGER DEFAULT 0 CHECK (passed_total >= 0),
    passed_female INTEGER DEFAULT 0 CHECK (passed_female >= 0),
    slow_learner_total INTEGER DEFAULT 0 CHECK (slow_learner_total >= 0),
    slow_learner_female INTEGER DEFAULT 0 CHECK (slow_learner_female >= 0),
    
    -- Subjectwise count of evaluations and remarks structured as JSONB for dynamic mapping
    -- Matches SubjectEvaluation interface structure: { evaluations: SubjectEvalItem[], teacherComment: string }
    subject_evaluations JSONB DEFAULT '{"evaluations": [], "teacherComment": ""}'::jsonb NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index report queries to load historical items efficiently
CREATE INDEX IF NOT EXISTS idx_school_reports_grade_month ON public.school_reports(grade, month);

-- ------------------------------------------------------------------------------
-- 3. TABLE FOR REPORT ACTIVITIES & PLANS (សកម្មភាពនិងផែនការសិក្សា)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.report_activities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID REFERENCES public.school_reports(id) ON DELETE CASCADE,
    lesson_title VARCHAR(255) NOT NULL,
    percentage_completed INTEGER NOT NULL CHECK (percentage_completed BETWEEN 0 AND 100),
    activity_type VARCHAR(20) NOT NULL CHECK (activity_type IN ('current_month', 'next_month')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 4. TABLE FOR STRUGGLING STUDENTS & REMEDIAL ACTIONS (បញ្ជីឈ្មោះសិស្សរៀនយឺត/ខ្សោយ និងសកម្មភាពដោះស្រាយ)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.struggling_students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID REFERENCES public.school_reports(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    gender VARCHAR(10) NOT NULL CHECK (gender IN ('ប្រុស', 'ស្រី')),
    issue TEXT NOT NULL,
    action_taken TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 5. TABLE FOR CHALLENGES & PROPOSED SOLUTIONS (បញ្ហាប្រឈម និងសំណើដំណោះស្រាយ)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.challenges_solutions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID REFERENCES public.school_reports(id) ON DELETE CASCADE,
    challenge TEXT NOT NULL,
    solution TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) FOR POWERFUL CLOUD DATA INTEGRITY
-- ==============================================================================

ALTER TABLE public.student_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.struggling_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges_solutions ENABLE ROW LEVEL SECURITY;

-- 1. Read-Only policies allowing all roles/anonymous to load grades & historical reports
CREATE POLICY "Allow public read access to student_scores" 
    ON public.student_scores FOR SELECT USING (true);

CREATE POLICY "Allow public read access to school_reports" 
    ON public.school_reports FOR SELECT USING (true);

CREATE POLICY "Allow public read access to report_activities" 
    ON public.report_activities FOR SELECT USING (true);

CREATE POLICY "Allow public read access to struggling_students" 
    ON public.struggling_students FOR SELECT USING (true);

CREATE POLICY "Allow public read access to challenges_solutions" 
    ON public.challenges_solutions FOR SELECT USING (true);

-- 2. Authenticated user full write access policies to update entries
CREATE POLICY "Allow instructors to insert/update scores" 
    ON public.student_scores FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow instructors to insert/update reports" 
    ON public.school_reports FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow instructors to insert/update activities" 
    ON public.report_activities FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow instructors to insert/update struggling list" 
    ON public.struggling_students FOR ALL TO authenticated USING (true);

CREATE POLICY "Allow instructors to insert/update challenges" 
    ON public.challenges_solutions FOR ALL TO authenticated USING (true);

-- ==============================================================================
-- REALTIME ENABLEMENT
-- ==============================================================================

-- Enable realtime broadcasts for live dashboards updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.student_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.school_reports;
