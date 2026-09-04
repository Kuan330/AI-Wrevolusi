from dataclasses import dataclass

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

CAPABILITY_TEXT_MATCHER_VERSION = 'epic3-wef-tfidf-cosine-v1'
CAPABILITY_TEXT_MATCHER_TYPE = 'scikit_learn_tfidf_cosine_similarity'
MINIMUM_CAPABILITY_SIMILARITY = 0.10
MAXIMUM_CAPABILITIES_PER_TASK = 2

# ponytail: these aliases cover the current three-occupation retail pilot.
# Replace them with a mentor-reviewed vocabulary before expanding the scope.
PILOT_ALIASES_BY_CAPABILITY_NAME: dict[str, tuple[str, ...]] = {
    'Analytical thinking': (
        'analyse budgets prices product mix financial records',
        'determine prices and product range',
    ),
    'Leadership and social influence': (
        'supervise coordinate schedule assign staff duties',
        'lead retail employees and shifts',
    ),
    'Empathy and active listening': (
        'listen to customers understand complaints and needs',
        'patient helpful customer interaction',
    ),
    'Talent management': (
        'hire interview evaluate promote and support staff',
        'manage employee performance and grievances',
    ),
    'Service orientation and customer service': (
        'serve customers promptly advise on products and warranties',
        'sell goods and resolve customer service issues',
    ),
    'Systems thinking': (
        'investigate returned goods and choose appropriate action',
        'understand connected retail processes',
    ),
    'Resource management and operations': (
        'manage inventory stock ordering purchasing and staff schedules',
        'coordinate shop operations and supplies',
    ),
    'Dependability and attention to detail': (
        'maintain accurate stock records and follow safety procedures',
        'check details and complete work reliably',
    ),
    'Quality control': (
        'inspect quality safety and returned goods',
        'take corrective action on quality problems',
    ),
    'Teaching and mentoring': (
        'instruct train teach and coach sales staff',
        'explain procedures and handle difficult cases',
    ),
    'Design and user experience': (
        'arrange product displays and improve customer experience',
        'display goods and plan product presentation',
    ),
    'Reading, writing and mathematics': (
        'prepare budgets invoices payments and financial records',
        'calculate prices and maintain written records',
    ),
    'Manual dexterity, endurance and precision': (
        'wrap pack stack and handle goods precisely',
        'manual packing and shelf work',
    ),
}


@dataclass(frozen=True)
class WefCapabilityProfile:
    wef_skill_id: int
    core_skill: str
    wef_skill_group: str | None


@dataclass(frozen=True)
class CapabilityTextSimilarityMatch:
    profile: WefCapabilityProfile
    similarity: float


def create_wef_capability_profile_text(profile: WefCapabilityProfile) -> str:
    profile_parts = [profile.core_skill, profile.wef_skill_group or '']
    profile_parts.extend(PILOT_ALIASES_BY_CAPABILITY_NAME.get(profile.core_skill, ()))
    return ' '.join(part for part in profile_parts if part)


def match_task_texts_to_wef_capability_profiles(
    task_texts: list[str],
    capability_profiles: list[WefCapabilityProfile],
    minimum_similarity: float = MINIMUM_CAPABILITY_SIMILARITY,
) -> list[list[CapabilityTextSimilarityMatch]]:
    if not task_texts or not capability_profiles:
        return [[] for _ in task_texts]

    capability_profile_texts = [
        create_wef_capability_profile_text(profile) for profile in capability_profiles
    ]
    capability_text_vectorizer = TfidfVectorizer(
        lowercase=True,
        stop_words='english',
        ngram_range=(1, 2),
        sublinear_tf=True,
        norm='l2',
    )
    capability_profile_vectors = capability_text_vectorizer.fit_transform(
        capability_profile_texts
    )
    task_vectors = capability_text_vectorizer.transform(task_texts)
    similarity_matrix = cosine_similarity(task_vectors, capability_profile_vectors)

    results: list[list[CapabilityTextSimilarityMatch]] = []
    for task_similarities in similarity_matrix:
        ranked_matches = sorted(
            (
                CapabilityTextSimilarityMatch(
                    profile=profile,
                    similarity=float(task_similarities[index]),
                )
                for index, profile in enumerate(capability_profiles)
                if task_similarities[index] >= minimum_similarity
            ),
            key=lambda match: match.similarity,
            reverse=True,
        )
        results.append(ranked_matches[:MAXIMUM_CAPABILITIES_PER_TASK])
    return results
