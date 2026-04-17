from app.routes.pdf import _build_reconciliation_filters


def test_build_reconciliation_filters_with_periods():
    filters = _build_reconciliation_filters("user-1", ["2026-02", "2026-03"])

    assert filters == [{"user_id": "user-1", "period": {"$in": ["2026-02", "2026-03"]}}]


def test_build_reconciliation_filters_without_periods():
    filters = _build_reconciliation_filters("user-1", None)

    assert filters == [{"user_id": "user-1"}]