import type { VoiceEntry } from "./resolveVoiceEntry";

/** Route params for `/transaction/new` from a resolved voice entry (group voice prefill included). */
export function toVoiceFormParams(r: VoiceEntry, transcript: string, groupId?: string): Record<string, string> {
  const params: Record<string, string> = { source: "voice", note: r.aiError && !r.note ? transcript : r.note };
  if (r.amount) params.amount = String(r.amount);
  if (r.categoryId) params.categoryId = r.categoryId;
  if (r.payerMemberId) params.payerMemberId = r.payerMemberId;
  if (r.aiError) params.aiError = r.aiError;
  if (groupId) params.groupId = groupId;
  return params;
}
