from enum import Enum


class TaskStatus(str, Enum):
    confirmed = 'confirmed'
    needs_review = 'needs_review'
    optional_context_missing = 'optional_context_missing'
