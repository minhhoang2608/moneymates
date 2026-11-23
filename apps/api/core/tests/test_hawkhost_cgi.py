import importlib.util
import json
from pathlib import Path

ENTRY = Path(__file__).resolve().parents[2] / "deploy" / "hawkhost" / "cgi_entry.py"


def _load():
    spec = importlib.util.spec_from_file_location("cgi_entry", ENTRY)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_load_app_env_reads_the_app_env_vars(tmp_path):
    config = tmp_path / "python-selector.json"
    config.write_text(
        json.dumps(
            {
                "moneymates/apps/api": {"env_vars": {"DJANGO_DEBUG": "0", "AI_LIMIT_PER_DAY": 50}},
                "other/app": {"env_vars": {"OTHER": "x"}},
            }
        )
    )
    env = _load().load_app_env(config, "moneymates/apps/api")
    assert env == {"DJANGO_DEBUG": "0", "AI_LIMIT_PER_DAY": "50"}


def test_load_app_env_is_empty_when_missing_or_invalid(tmp_path):
    cgi = _load()
    assert cgi.load_app_env(tmp_path / "missing.json", "moneymates/apps/api") == {}
    bad = tmp_path / "bad.json"
    bad.write_text("{not json")
    assert cgi.load_app_env(bad, "moneymates/apps/api") == {}


def test_path_info_from_uri_drops_the_query_and_decodes_per_pep_3333():
    cgi = _load()
    assert cgi.path_info_from_uri("/health/?x=1") == "/health/"
    assert cgi.path_info_from_uri("/ai/parse-text") == "/ai/parse-text"
    assert cgi.path_info_from_uri("/a%20b") == "/a b"
    assert cgi.path_info_from_uri("/caf%C3%A9") == "/café".encode().decode("latin-1")
    assert cgi.path_info_from_uri("") == "/"
