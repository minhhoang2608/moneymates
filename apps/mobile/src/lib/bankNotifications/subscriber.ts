import { parseVietQr } from "../vietqr";
import { allowedPackagesFor } from "./allowedPackages";
import { MATCH_WINDOW_MS, matchNotification, parseBankNotification, type MatchableHandOff } from "./index";

type Incoming = { packageName: string; title: string; text: string; postedAt: number };

export type BankNotificationSubscriberDeps = {
  listener: {
    subscribe: (handler: (e: Incoming) => void, allowedPackages: string[]) => () => void;
    isAccessGranted: () => Promise<boolean>;
  };
  preferences: { getAutoDetectTransfers: () => Promise<boolean> };
  paymentAppPrefs: { getEnabledApps: () => Promise<string[]>; hasChosen: () => Promise<boolean> };
  handOffs: {
    listReceiptCandidates: (since: Date) => Promise<
      {
        handOff: { id: string; started_at: string; paid_signal: string | null };
        amount: number;
        qr_data: string | null;
      }[]
    >;
    markPaid: (id: string, signal: "notification") => Promise<boolean>;
  };
  /** Enabled ids to use when the user has not chosen yet (detected apps). */
  defaultEnabled?: () => Promise<string[]>;
  now?: () => number;
  onMatched?: (e: { handOffId: string }) => void;
};

/**
 * Marks a hand-off paid when a bank notification matches it. Notification title and text are only read in memory:
 * nothing is stored, logged or sent.
 */
export function createBankNotificationSubscriber(deps: BankNotificationSubscriberDeps) {
  const now = deps.now ?? Date.now;
  let unsubscribe: (() => void) | null = null;
  let packages: string[] = [];
  let generation = 0;

  function stop(): void {
    generation += 1;
    unsubscribe?.();
    unsubscribe = null;
  }

  async function handle(e: Incoming): Promise<string | null> {
    try {
      const parsed = parseBankNotification(e.packageName, e.title, e.text);
      if (!parsed) return null;
      const t = now();
      const rows = await deps.handOffs.listReceiptCandidates(new Date(t - MATCH_WINDOW_MS * 2));
      const candidates: MatchableHandOff[] = rows.map((r) => {
        const qr = r.qr_data ? parseVietQr(r.qr_data) : null;
        const v = qr && qr.kind === "vietqr" ? qr : null;
        return {
          id: r.handOff.id,
          amount: r.amount,
          accountNumber: v?.account,
          message: v?.message,
          startedAt: new Date(r.handOff.started_at).getTime(),
          paidSignal: r.handOff.paid_signal as MatchableHandOff["paidSignal"],
        };
      });
      const id = matchNotification({
        notification: { ...parsed, packageName: e.packageName, postedAt: e.postedAt },
        handOffs: candidates,
        enabledPackages: packages,
        now: t,
      });
      if (!id) return null;
      if (await deps.handOffs.markPaid(id, "notification")) {
        deps.onMatched?.({ handOffId: id });
        return id;
      }
    } catch {
      console.warn("bank notification handling failed");
    }
    return null;
  }

  /** (Re)subscribes when auto-detect is on and access is granted, else unsubscribes. */
  async function sync(): Promise<void> {
    const gen = ++generation;
    try {
      const on = (await deps.preferences.getAutoDetectTransfers()) && (await deps.listener.isAccessGranted());
      let ids: string[] = [];
      if (on) {
        ids = (await deps.paymentAppPrefs.hasChosen())
          ? await deps.paymentAppPrefs.getEnabledApps()
          : ((await deps.defaultEnabled?.()) ?? []);
      }
      if (gen !== generation) return;
      unsubscribe?.();
      unsubscribe = null;
      if (!on) return;
      packages = allowedPackagesFor(ids);
      unsubscribe = deps.listener.subscribe((e) => void handle(e), packages);
    } catch {
      console.warn("bank notification sync failed");
    }
  }

  return { sync, stop, handle };
}
