User / session tables for Iteration 1 (E1–E4).

Live rows are written by the app into Postgres / Neon, not into these CSVs.
These files are header-only schema sketches; db/schema.sql is the database contract.

Lookup data is not here. Import from raw into data/reference/, then seed Neon:
  python3 data/reference/import_from_raw.py
  python3 db/seed_reference.py

Route
  ref_occupations.occupation_code (level=unit)
    -> ref_ilo_tasks (isco_08); user copies confirmed rows into profile_tasks
    -> task_assessments (exact ILO score, else nlp/llm)
    -> profile_wef_skills + wef_skill_task_links (nlp/llm; wef_core_skill from ref_wef_skills)
    -> review_events (E4)

Speech-to-text: profile_tasks.input_method = speech; store text in task_text.

See docs/iteration1_erd.md
