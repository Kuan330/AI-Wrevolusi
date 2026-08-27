-- Neon SQL Editor:
-- 1. Branch dropdown = dev (not production).
-- 2. Database dropdown = neondb.
-- Tables live in schema public. This script uses public. so search_path does not matter.
--
-- If you still get "does not exist", run this first:
--   SELECT current_database(), current_schema();
--   SELECT table_schema, table_name
--   FROM information_schema.tables
--   WHERE table_name LIKE 'ref_%'
--   ORDER BY 1, 2;

SELECT
    check_name,
    expected,
    actual,
    (actual = expected) AS ok
FROM (
    SELECT 'ref_occupations rows' AS check_name, 6 AS expected, COUNT(*)::int AS actual
    FROM public.ref_occupations

    UNION ALL
    SELECT 'ref_ilo_tasks rows', 20, COUNT(*)::int
    FROM public.ref_ilo_tasks

    UNION ALL
    SELECT 'ref_wef_skills rows', 26, COUNT(*)::int
    FROM public.ref_wef_skills

    UNION ALL
    SELECT 'major nodes', 1, COUNT(*)::int
    FROM public.ref_occupations
    WHERE level = 'major'

    UNION ALL
    SELECT 'unit nodes 5221/5222/5223', 3, COUNT(*)::int
    FROM public.ref_occupations
    WHERE occupation_code IN ('5221', '5222', '5223')
      AND level = 'unit'
      AND parent_code = '522'

    UNION ALL
    SELECT 'children of 522', 3, COUNT(*)::int
    FROM public.ref_occupations
    WHERE parent_code = '522'

    UNION ALL
    SELECT 'ILO tasks for 5221', 7, COUNT(*)::int
    FROM public.ref_ilo_tasks
    WHERE isco_08 = '5221'

    UNION ALL
    SELECT 'ILO tasks for 5222', 8, COUNT(*)::int
    FROM public.ref_ilo_tasks
    WHERE isco_08 = '5222'

    UNION ALL
    SELECT 'ILO tasks for 5223', 5, COUNT(*)::int
    FROM public.ref_ilo_tasks
    WHERE isco_08 = '5223'

    UNION ALL
    SELECT 'ILO only on unit codes', 0, COUNT(*)::int
    FROM public.ref_ilo_tasks t
    LEFT JOIN public.ref_occupations o
      ON o.occupation_code = t.isco_08 AND o.level = 'unit'
    WHERE o.occupation_code IS NULL

    UNION ALL
    SELECT 'occupation parent exists', 0, COUNT(*)::int
    FROM public.ref_occupations c
    WHERE COALESCE(c.parent_code, '') <> ''
      AND NOT EXISTS (
          SELECT 1
          FROM public.ref_occupations p
          WHERE p.occupation_code = c.parent_code
      )

    UNION ALL
    SELECT 'WEF ids 1-26', 26, COUNT(*)::int
    FROM public.ref_wef_skills
    WHERE wef_skill_id BETWEEN 1 AND 26

    UNION ALL
    SELECT 'users empty', 0, COUNT(*)::int FROM public.users
    UNION ALL
    SELECT 'work_profiles empty', 0, COUNT(*)::int FROM public.work_profiles
    UNION ALL
    SELECT 'profile_tasks empty', 0, COUNT(*)::int FROM public.profile_tasks
    UNION ALL
    SELECT 'task_assessments empty', 0, COUNT(*)::int FROM public.task_assessments
    UNION ALL
    SELECT 'profile_wef_skills empty', 0, COUNT(*)::int FROM public.profile_wef_skills
    UNION ALL
    SELECT 'wef_skill_task_links empty', 0, COUNT(*)::int FROM public.wef_skill_task_links
    UNION ALL
    SELECT 'skill_examples empty', 0, COUNT(*)::int FROM public.skill_examples
    UNION ALL
    SELECT 'review_events empty', 0, COUNT(*)::int FROM public.review_events
) checks
ORDER BY check_name;
