def completion_rate(completed: int, total: int) -> float:
    if total <= 0:
        return 0.0
    return round((completed / total) * 100, 2)


def mean(values: list[float]) -> float:
    if not values:
        return 0.0
    return sum(values) / len(values)
