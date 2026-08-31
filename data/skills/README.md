# WEF Skill Inference v1.4

Frozen workbook assets for LLM-only skill inference.

## Layout

- `export_workbook_v1_4.py` — export from `WEF_skill_inference_review_v1_4.xlsm`
- `v1.4/manifest.json` — version metadata
- `v1.4/skills/WEF-*.json` — 26 skill profiles
- `v1.4/schemas/` — input/output JSON Schema
- `v1.4/eval/` — 80 approved evaluation tasks + labels
- `v1.4/prompts/` — system + skills handbook for prompt v1

## Regenerate

```bash
python3 data/skills/export_workbook_v1_4.py --workbook /path/to/WEF_skill_inference_review_v1_4.xlsm
```

Requires `pandas` and `openpyxl`.
