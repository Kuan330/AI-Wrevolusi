from app.utils.calculation import completion_rate


def test_completion_rate() -> None:
    assert completion_rate(2, 4) == 50.0
    assert completion_rate(0, 0) == 0.0
