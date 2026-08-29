from app.constants.exposure_types import ExposureType
from app.services.exposure import infer_exposure_state


def test_infer_exposure_for_reporting_task() -> None:
    exposure, confidence, _ = infer_exposure_state('Prepare weekly sales report')
    assert exposure == ExposureType.partly_automated
    assert confidence > 0.5
