export type DepositSlot = {
  phone: string;
  name: string;
};

export function depositSlotsFromSettings(settings: {
  depositPhone1?: string;
  depositName1?: string;
  depositPhone2?: string;
  depositName2?: string;
}): DepositSlot[] {
  return [
    {
      phone: (settings.depositPhone1 || "").trim(),
      name: (settings.depositName1 || "").trim(),
    },
    {
      phone: (settings.depositPhone2 || "").trim(),
      name: (settings.depositName2 || "").trim(),
    },
  ].filter((s) => s.phone.length > 0);
}
