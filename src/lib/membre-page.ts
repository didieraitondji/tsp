import { requireMembreAccess } from "@/lib/auth/session";
import {
  getMemberProgress,
  listMemberTontines,
  resolveMemberTontineId,
  type MemberProgress,
  type MemberTontineOption,
} from "@/lib/db/domain";

export type MembrePageContext = {
  sessionName: string;
  memberId: string | null | undefined;
  tontines: MemberTontineOption[];
  periodId: string | null;
  progress: MemberProgress | null;
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
    };
  }

  const tontines = await listMemberTontines(memberId);
  const periodId = resolveMemberTontineId(tontines, requestedTontine);
  const progress = await getMemberProgress(memberId, periodId);

  return {
    sessionName: session.user.name,
    memberId,
    tontines,
    periodId,
    progress,
  };
}
