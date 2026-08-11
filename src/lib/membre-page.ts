import { requireMembreAccess } from "@/lib/auth/session";
import {
  getMemberProgress,
  listMemberTontines,
  resolveMemberTontineId,
  type MemberProgress,
  type MemberTontineOption,
} from "@/lib/db/domain";
import { DEFAULT_SETTINGS, resolveSettings } from "@/lib/db/defaults";
import { readObjectForPeriodId } from "@/lib/db/store";
import {
  depositSlotsFromSettings,
  type DepositSlot,
} from "@/lib/deposit";
import type { Settings } from "@/lib/types";

export type MembrePageContext = {
  sessionName: string;
  memberId: string | null | undefined;
  tontines: MemberTontineOption[];
  periodId: string | null;
  progress: MemberProgress | null;
  depositSlots: DepositSlot[];
};

export async function loadMembreContext(
  requestedTontine?: string | null
): Promise<MembrePageContext> {
  const session = await requireMembreAccess();
  const memberId = session.user.memberId;
  if (!memberId) {
    return {
      sessionName: session.user.name,
      memberId,
      tontines: [],
      periodId: null,
      progress: null,
      depositSlots: [],
    };
  }

  const tontines = await listMemberTontines(memberId);
  const periodId = resolveMemberTontineId(tontines, requestedTontine);
  const progress = await getMemberProgress(memberId, periodId);

  let depositSlots: DepositSlot[] = [];
  if (periodId) {
    const raw = await readObjectForPeriodId<Settings>(
      periodId,
      "settings",
      DEFAULT_SETTINGS
    );
    depositSlots = depositSlotsFromSettings(resolveSettings(raw));
  }

  return {
    sessionName: session.user.name,
    memberId,
    tontines,
    periodId,
    progress,
    depositSlots,
  };
}
