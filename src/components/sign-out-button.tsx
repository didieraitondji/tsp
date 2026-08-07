"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Modal } from "@/components/modal";
import { Button } from "./ui";

export function SignOutButton() {
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Déconnexion
      </Button>
      <Modal
        open={open}
        onClose={() => !loggingOut && setOpen(false)}
        title="Se déconnecter"
        description="Vous quitterez votre session en cours."
      >
        <p className="text-sm text-[var(--muted)]">Confirmer la déconnexion ?</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            disabled={loggingOut}
            onClick={() => setOpen(false)}
            className="cursor-pointer rounded-full border border-[var(--line)] px-4 py-2 text-sm font-medium text-[var(--navy)] transition hover:bg-[var(--cream)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={loggingOut}
            onClick={async () => {
              setLoggingOut(true);
              try {
                await signOut({ redirect: false });
                window.location.assign("/login");
              } finally {
                setLoggingOut(false);
              }
            }}
            className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-wait disabled:opacity-60"
          >
            {loggingOut ? "Déconnexion…" : "Se déconnecter"}
          </button>
        </div>
      </Modal>
    </>
  );
}
