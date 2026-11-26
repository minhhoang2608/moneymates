from banks.merge import merge

from .conftest import ANDROID, BANKS, IOS


def by_id(apps):
    return {a["app_id"]: a for a in apps}


def test_merges_android_and_ios_by_app_id():
    apps = by_id(merge(ANDROID["apps"], IOS["apps"], BANKS["data"]))
    assert set(apps) == {"mb", "momo", "vcb", "stb"}
    assert apps["mb"]["name"] == "MB Bank"


def test_autofill_per_platform():
    apps = by_id(merge(ANDROID["apps"], IOS["apps"], BANKS["data"]))
    assert apps["mb"]["autofill"] == {"android": True, "ios": False}
    assert apps["vcb"]["autofill"] == {"android": False, "ios": True}
    assert apps["momo"]["autofill"] == {"android": False, "ios": False}


def test_bin_and_code_from_banks():
    apps = by_id(merge(ANDROID["apps"], IOS["apps"], BANKS["data"]))
    assert apps["mb"]["bank_code"] == "MB"
    assert apps["mb"]["bin"] == "970422"
    assert apps["vcb"]["bin"] == "970436"


def test_unknown_bank_and_launch_fields_are_null():
    merged = merge([{"appId": "zzz", "appName": "Zed", "autofill": 1}], [], [])
    apps = [a for a in merged if a["app_id"] == "zzz"]
    assert apps[0]["bank_code"] is None
    assert apps[0]["bin"] is None
    assert apps[0]["ios_scheme"] is None
    assert apps[0]["android_package"] is None


def test_known_launch_fields():
    apps = by_id(merge(ANDROID["apps"], IOS["apps"], BANKS["data"]))
    assert apps["mb"]["ios_scheme"] == "mbbank"
    assert apps["mb"]["android_package"] == "com.mbmobile"


def test_app_only_in_one_registry():
    apps = by_id(merge(ANDROID["apps"], IOS["apps"], BANKS["data"]))
    assert apps["momo"]["autofill"]["ios"] is False
    assert apps["vcb"]["autofill"]["android"] is False


def test_rows_without_app_id_are_skipped():
    assert [a["app_id"] for a in merge([{"appName": "x"}], [], [])] == ["stb"]


def test_sacombank_pay_is_added_when_the_registry_lacks_it():
    stb = by_id(merge(ANDROID["apps"], IOS["apps"], BANKS["data"]))["stb"]
    assert stb["name"] == "Sacombank Pay"
    assert stb["bin"] == "970403"
    assert stb["android_package"] == "com.sacombank.ewallet"
    assert stb["autofill"] == {"android": False, "ios": False}


def test_a_registry_entry_wins_over_the_extra_one():
    apps = merge([{"appId": "stb", "appName": "Sacombank (VietQR)", "autofill": 0}], [], [])
    assert [a["name"] for a in apps if a["app_id"] == "stb"] == ["Sacombank (VietQR)"]
