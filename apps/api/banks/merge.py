# Launch data the registries do not publish (app_id -> (ios_scheme, android_package)).
# Kept identical to the mobile snapshot (apps/mobile/src/lib/vietqr/bankApps.snapshot.json):
# without the Android package the app cannot share the QR to the bank app
# (Techcombank's QR popup) and only opens it.
KNOWN_LAUNCH = {
    "mb": ("mbbank", "com.mbmobile"),
    "tpb": ("hydro", "com.tpb.mb.gprsandroid"),
    "tcb": ("tcb", "vn.com.techcombank.bb.app"),
    "vcb": ("vietcombankmobile", "com.VCB"),
    "icb": ("vietinbankipay", "com.vietinbank.ipay"),
    "momo": ("momo", None),
}

# Bank apps missing from VietQR's deeplink registries. A registry entry with the same app_id wins.
EXTRA_APPS = [
    {
        "app_id": "stb",
        "name": "Sacombank Pay",
        "logo": None,
        "bank_code": "STB",
        "bin": "970403",
        "autofill": {"android": False, "ios": False},
        "ios_scheme": None,
        "android_package": "com.sacombank.ewallet",
    },
]


def _id(row):
    value = row.get("appId")
    return value.strip().lower() if isinstance(value, str) and value.strip() else None


def _index(rows):
    out = {}
    for row in rows:
        key = _id(row)
        if key and key not in out:
            out[key] = row
    return out


def _text(value):
    return value if isinstance(value, str) and value else None


def merge(android, ios, banks):
    android, ios = _index(android), _index(ios)
    by_code = {}
    for bank in banks:
        code = bank.get("code")
        if isinstance(code, str) and code and code.lower() not in by_code:
            by_code[code.lower()] = bank
    apps = []
    for app_id in set(android) | set(ios):
        a, i = android.get(app_id), ios.get(app_id)
        main = a or i
        bank = by_code.get(app_id)
        known_ios, known_android = KNOWN_LAUNCH.get(app_id, (None, None))
        apps.append(
            {
                "app_id": app_id,
                "name": _text(main.get("appName")) or app_id,
                "logo": _text(main.get("appLogo")),
                "bank_code": _text(bank.get("code")) if bank else None,
                "bin": _text(bank.get("bin")) if bank else None,
                "autofill": {
                    "android": bool(a and a.get("autofill") == 1),
                    "ios": bool(i and i.get("autofill") == 1),
                },
                "ios_scheme": _text((i or {}).get("iosScheme")) or known_ios,
                "android_package": _text((a or {}).get("androidPackage")) or known_android,
            }
        )
    have = {a["app_id"] for a in apps}
    apps.extend(
        {**extra, "autofill": dict(extra["autofill"])}
        for extra in EXTRA_APPS
        if extra["app_id"] not in have
    )
    apps.sort(key=lambda x: (x["name"].casefold(), x["app_id"]))
    return apps
