import asyncio
import json
import uuid

import httpx

from app.core.config import settings
from app.schemas.skill_direction import (
    LearningTheme,
    SkillDirectionAnalysisRequest,
    SkillDirectionAnalysisResponse,
)


class SkillDirectionConfigurationError(RuntimeError):
    pass


class SkillDirectionGenerationError(RuntimeError):
    pass


THEME_RESPONSE_SCHEMA = {
    'type': 'object',
    'additionalProperties': False,
    'required': ['skills'],
    'properties': {
        'skills': {
            'type': 'array',
            'items': {
                'type': 'object',
                'additionalProperties': False,
                'required': ['skill_id', 'themes'],
                'properties': {
                    'skill_id': {'type': 'integer'},
                    'themes': {
                        'type': 'array',
                        'minItems': 2,
                        'maxItems': 2,
                        'items': {
                            'type': 'object',
                            'additionalProperties': False,
                            'required': ['title', 'description', 'why_relevant'],
                            'properties': {
                                'title': {'type': 'string'},
                                'description': {'type': 'string'},
                                'why_relevant': {'type': 'string'},
                            },
                        },
                    },
                },
            },
        }
    },
}


def _response_text(payload: dict) -> str:
    try:
        content = payload['choices'][0]['message']['content']
    except (KeyError, IndexError, TypeError) as exc:
        raise SkillDirectionGenerationError(
            'The model did not return learning themes.'
        ) from exc
    if not isinstance(content, str) or not content:
        raise SkillDirectionGenerationError('The model did not return learning themes.')
    return content


async def generate_learning_themes(
    request: SkillDirectionAnalysisRequest,
) -> SkillDirectionAnalysisResponse:
    if not settings.skill_llm_api_key:
        raise SkillDirectionConfigurationError(
            'Skill learning analysis is not configured yet. Set SKILL_LLM_API_KEY on the backend.'
        )

    skill_payload = [skill.model_dump() for skill in request.skills]
    instructions = (
        'You are a career learning guide for working adults. The user has already '
        'confirmed how they want to approach each skill. Respect those directions; '
        'do not reclassify them. For every supplied skill, propose exactly two broad, '
        'practical learning themes. Themes are stepping stones for a later course search, '
        'so do not name course providers, certifications, products, or URLs. Use plain '
        'English, avoid promises, and connect each suggestion to the supplied work evidence '
        'and external outlook without treating research signals as personal scores. Return '
        'only a JSON object matching this JSON Schema: '
        f'{json.dumps(THEME_RESPONSE_SCHEMA)}'
    )
    body = {
        'model': settings.skill_llm_model,
        'messages': [
            {
                'role': 'system',
                'content': f'Prompt version: {settings.skill_prompt_version}. {instructions}',
            },
            {
                'role': 'user',
                'content': json.dumps(
                    {
                        'occupation_title': request.occupation_title,
                        'confirmed_skill_directions': skill_payload,
                    }
                ),
            },
        ],
        'response_format': {'type': 'json_object'},
    }

    headers = {
        'Authorization': f'Bearer {settings.skill_llm_api_key}',
        'Content-Type': 'application/json',
    }
    if settings.skill_llm_app_url:
        headers['HTTP-Referer'] = settings.skill_llm_app_url
    if settings.skill_llm_app_name:
        headers['X-OpenRouter-Title'] = settings.skill_llm_app_name

    endpoint = f"{settings.skill_llm_base_url.rstrip('/')}/chat/completions"
    generated: dict | None = None
    try:
        async with httpx.AsyncClient(timeout=settings.skill_request_timeout_s) as client:
            for attempt in range(settings.skill_max_retries + 1):
                response = await client.post(endpoint, headers=headers, json=body)
                if response.status_code < 400:
                    generated = json.loads(_response_text(response.json()))
                    break
                if response.status_code not in {408, 409, 429} and response.status_code < 500:
                    response.raise_for_status()
                if attempt >= settings.skill_max_retries:
                    response.raise_for_status()
                await asyncio.sleep(0.5 * (2**attempt))
    except (httpx.HTTPError, json.JSONDecodeError, KeyError, TypeError) as exc:
        raise SkillDirectionGenerationError(
            'Learning themes could not be generated. Please try again.'
        ) from exc

    if generated is None:
        raise SkillDirectionGenerationError('The model did not return learning themes.')

    requested_by_id = {skill.skill_id: skill for skill in request.skills}
    themes: list[LearningTheme] = []
    completed_skill_ids: set[int] = set()
    try:
        for result in generated.get('skills', []):
            source = requested_by_id.get(result.get('skill_id'))
            if not source or source.skill_id in completed_skill_ids:
                continue
            generated_themes = result.get('themes', [])
            if len(generated_themes) != 2:
                continue
            for theme in generated_themes:
                themes.append(
                    LearningTheme(
                        theme_id=str(uuid.uuid4()),
                        skill_id=source.skill_id,
                        skill_name=source.skill_name,
                        direction=source.direction,
                        title=theme['title'],
                        description=theme['description'],
                        why_relevant=theme['why_relevant'],
                    )
                )
            completed_skill_ids.add(source.skill_id)
    except (KeyError, TypeError, ValueError) as exc:
        raise SkillDirectionGenerationError(
            'The model returned learning themes in an unexpected format.'
        ) from exc

    if completed_skill_ids != set(requested_by_id):
        raise SkillDirectionGenerationError(
            'The model did not return learning themes for every confirmed skill.'
        )
    return SkillDirectionAnalysisResponse(themes=themes)
