export type PermissionKind = "camera" | "photos" | "microphone";

/** `not_asked` = the system dialog has never been shown (or the OS reset it). */
export type PermissionState = "not_asked" | "granted" | "denied";

/** The subset of Expo's `PermissionResponse` the module reads. */
export type PermissionResponse = {
  status?: "undetermined" | "granted" | "denied";
  granted?: boolean;
  canAskAgain?: boolean;
  /** iOS photos only. */
  accessPrivileges?: "all" | "limited" | "none";
};

export type PermissionAdapter = {
  get(kind: PermissionKind): Promise<PermissionResponse>;
  request(kind: PermissionKind): Promise<PermissionResponse>;
  openSettings(): Promise<void>;
};
