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


def build_bill_messages(image_b64, mime, categories):
    system = (
        "You read a photo of a Vietnamese shop bill or receipt. "
        "Reply with a single JSON object only, with keys: "
        '"amount" (the final total paid as an integer VND, or null), '
        '"shop" (shop name or null), '
        '"date" (YYYY-MM-DD or null), '
        '"category" (one of the allowed categories or null). '
        "Never return decimals for amount. If unsure about a field, use null.\n"
        f"Allowed categories: {json.dumps(categories, ensure_ascii=False)}"
    )
    return [
        {"role": "system", "content": system},
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Extract the bill fields."},
                {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_b64}"}},
            ],
        },
    ]
