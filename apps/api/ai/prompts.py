import json


def build_messages(text, categories, members):
    system = (
        "You extract one expense from a short Vietnamese sentence. "
        "Reply with a single JSON object only, with keys: "
        '"amount" (integer VND or null), "note" (short string or null), '
        '"category" (one of the allowed categories or null), '
        '"payer" (one of the allowed members or null). '
        'Understand Vietnamese money words: "50k" = 50000, "1tr2" = 1200000, '
        '"hai trăm nghìn" = 200000. Never return decimals for amount. '
        "If unsure about a field, use null.\n"
        f"Allowed categories: {json.dumps(categories, ensure_ascii=False)}\n"
        f"Allowed members: {json.dumps(members, ensure_ascii=False)}"
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": text}]
