Epic 9 interview question bank (reference data only, no personal data).

Source: Epic9_Interview_Question_Bank_V1 delivery (491 MASCO unit occupations,
2,440 questions, 18,078 occupation-question links, 81 sources).

Files -> tables (loaded by db/seed_reference.py)
  ref_interview_sources.csv              ref_interview_sources
  ref_interview_questions.csv            ref_interview_questions
  ref_interview_coverage.csv             ref_interview_coverage
  ref_interview_occupation_questions.csv ref_interview_occupation_questions

Cleaning done on the delivery CSVs
  - UTF-8 without BOM, LF line endings, spaces trimmed.
  - Dropped columns that repeat data already in ref_occupations
    (occupation_title, and quality_tier on questions and links).
    Get titles by joining ref_occupations on occupation_code.
  - source_ids is stored as a Postgres text array.
  - Loader checks: no duplicate keys or question text, every source_id and
    question_id resolves, every occupation has at least 5 questions, and
    coverage counts match the links.

Get the questions for one occupation, best first:

  SELECT q.question_id, q.primary_intent, q.question
  FROM ref_interview_occupation_questions m
  JOIN ref_interview_questions q USING (question_id)
  WHERE m.occupation_code = '2512'
  ORDER BY m.display_order;

scope: Exact = written for that occupation, Family = for its 3-digit group,
Common = general questions linked to every occupation.
quality_tier (ref_interview_coverage): Curated > Preferred > Standard >
Generalized (NEC).

Known limits for Epic 9
  - Only 5 questions mention AI or automation. Epic 9 AI-change questions
    (criteria 9.1.4) must be written by the AI from the resume item, not
    picked from this bank.
  - Many Exact questions are role templates with the occupation title filled
    in. They are practice starters, not employer questions.
  - No question asks about the candidate's age, family, marital status or
    religion (checked by keyword search; religion appears only in clergy
    and religious-teaching occupations).
