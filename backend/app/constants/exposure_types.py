from enum import Enum


class ExposureType(str, Enum):
    human_led = 'human_led'
    ai_assisted = 'ai_assisted'
    partly_automated = 'partly_automated'
    automated = 'automated'
    insufficient_data = 'insufficient_data'
