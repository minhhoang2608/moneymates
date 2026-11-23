export type TargetGroup = {
  id: string;
  name: string;
  icon: string;
  /** `YYYY-MM-DD` or null. */
  end_date: string | null;
  /** ISO UTC. */
  created_at: string;
};

export type Target =
  { kind: "personal" } | { kind: "group"; groupId: string; name: string; icon: string; ended: boolean };

/** The newest live transaction: when it was recorded and where it went. */
export type LastUsed = { target: "personal" | { groupId: string }; at: string } | null;
