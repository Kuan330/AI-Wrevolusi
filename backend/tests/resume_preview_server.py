"""Local QA renderer only. Never use this synthetic-auth app in production."""
import os
os.environ['AI_API_KEY'] = ''
os.environ['AI_KEYLESS'] = 'false'
os.environ['AI_FALLBACK_ENABLED'] = 'false'
os.environ['AUTO_CREATE_TABLES'] = 'false'
os.environ['JWT_SECRET_KEY'] = 'synthetic-resume-browser-test-only'
from fastapi import FastAPI, Request
from types import SimpleNamespace
from app.routers.resume import router
from app.services.auth import get_current_user
from app.routers.resume import get_resume_provider, get_resume_role_loader

app = FastAPI()
app.include_router(router, prefix='/api/v1')
app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id='synthetic-browser-account')


class SyntheticResumeProvider:
    """Offline QA only: deliberately omits skills so server coverage is exercised."""
    def __init__(self, scenario="ok"):
        self.scenario = scenario

    async def complete_json_async(self, **kwargs):
        from app.services.ai_gateway import AIProviderError
        if self.scenario == "unavailable": raise AIProviderError("Synthetic offline provider", status_code=503, kind="http")
        if self.scenario == "invalid": return {"unexpected": "Synthetic invalid output"}
        if self.scenario in {"slow", "progress"}:
            import asyncio
            await asyncio.sleep(5 if self.scenario == "progress" else 2)
        decisions = []
        for candidate in kwargs["payload"].get("skill_candidates", []):
            requirements = kwargs["payload"]["target_role"]["required_skills"]
            anchor = requirements[0]["skill_id"]
            if self.scenario in {"role_relevance", "all_unrelated", "relevance_invalid"}:
                anchor = anchor if self.scenario != "all_unrelated" and candidate["name"] in {"SQL", "Excel", "Programming", "Creative thinking", "AI and big data", "Reading, writing and mathematics"} else None
            decisions.append({"candidate_id": candidate["candidate_id"], "requirement_skill_id": anchor})
        if self.scenario == "relevance_invalid" and decisions:
            decisions[0]["requirement_skill_id"] = 999999
        return {"skill_decisions": decisions, "patches": [{"fact_id": f["id"], "text": f["text"].lstrip("•●▪*- ")} for f in kwargs["payload"].get("facts", [])], "gaps": []}

    def complete_json(self, **kwargs):
        payload = kwargs["payload"]
        facts = {f["id"]: f["text"] for f in payload.get("evidence", [])}
        sections = []
        if payload.get("skills"):
            first = payload["skills"][0]
            sections.append({"title": "Skills", "entries": [{"text": first["name"], "skill_ids": [first["id"]]}]})
        projects = []
        for project in payload.get("source_projects") or []:
            if project["mode"] != "structured": continue
            projects.append({"text": project["name"], "fact_ids": project["fact_ids"], "project_id": project["id"],
                "project": {"name": project["name"], "date": project.get("date"), "highlights": [facts[fid].lstrip("•●▪*- ") for fid in project["highlight_fact_ids"]]}})
        if projects: sections.append({"title": "Projects", "entries": projects})
        return {"sections": sections, "gaps": []}

def preview_provider(request: Request):
    return SyntheticResumeProvider(request.headers.get("X-Resume-QA-Scenario", "ok"))

app.dependency_overrides[get_resume_provider] = preview_provider


# Synthetic-only database stand-in. Production never reads this QA header.
def preview_role_loader(request: Request):
    async def load(code):
        import json
        from app.schemas.possibilities import OccupationRequirements
        from app.services.resume_errors import GenerationFailure
        raw = request.headers.get("X-Resume-QA-Role")
        if raw is None:
            raise GenerationFailure("Synthetic role fixture is required.", code="role_reference_unavailable")
        role = OccupationRequirements.model_validate(json.loads(raw))
        if role.occupation_code != code:
            raise GenerationFailure("Synthetic role code mismatch.", code="target_role_changed")
        return role
    return load

app.dependency_overrides[get_resume_role_loader] = preview_role_loader
