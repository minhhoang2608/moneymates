from concurrent.futures import ThreadPoolExecutor

import pytest
from django.db import connection

from ai.limits import _hit_db

pytestmark = pytest.mark.skipif(
    connection.vendor != "postgresql", reason="atomic counter needs PostgreSQL"
)


def test_sequential_increments():
    assert [_hit_db("k1", 60) for _ in range(3)] == [1, 2, 3]


def test_keys_are_independent():
    assert _hit_db("a", 60) == 1
    assert _hit_db("b", 60) == 1
    assert _hit_db("a", 60) == 2


def test_expired_row_resets():
    _hit_db("k2", 60)
    _hit_db("k2", 60)
    with connection.cursor() as cur:
        cur.execute("UPDATE ai_counter SET expires_at = now() - interval '1 second'")
    assert _hit_db("k2", 60) == 1


@pytest.mark.django_db(transaction=True)
def test_concurrent_increments_are_exact():
    def work(_):
        try:
            return _hit_db("conc", 60)
        finally:
            connection.close()

    with ThreadPoolExecutor(10) as ex:
        results = list(ex.map(work, range(10)))
    assert sorted(results) == list(range(1, 11))
