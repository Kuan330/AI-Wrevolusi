ILO task embeddings for NLP exposure scoring.

Index source: data/raw/ilo_task_score_raw.csv (full Gmyrek file).
Do not use data/reference/ref_ilo_tasks.csv — that file is the E1 starter subset.

Build the e5 index (optional; hashed n-grams are used until this exists):

  cd backend
  python -m app.nlp.build_ilo_index

Output: ilo_tasks_<model>.npz (gitignored).
