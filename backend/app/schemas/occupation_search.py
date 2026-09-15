"""Schemas for the occupation search support layer."""

from pydantic import BaseModel, ConfigDict, Field


class OccupationSearchKeywords(BaseModel):
    """English search keywords proposed for a non-English search query.

    The keywords only steer the deterministic token search; every returned
    occupation is still a ``ref_occupations`` row.
    """

    model_config = ConfigDict(extra='forbid')

    keywords: list[str] = Field(default_factory=list, max_length=12)


__all__ = ['OccupationSearchKeywords']
