import qr from "../../e2e/fixtures/qr.json";
import features from "../../e2e/fixtures/features.json";

export const e2eQr = qr as { dynamic: string; static: string; merchant: string; invalid: string };

export const e2eFeatures = features as { ai_enabled: boolean; ai_parse_text: boolean; ai_parse_bill: boolean };
