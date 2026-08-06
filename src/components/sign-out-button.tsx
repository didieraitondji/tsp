"use client";

import { signOut } from "next-auth/react";
import { Button } from "./ui";

export function SignOutButton() {
  return (
    <Button type="button" variant="secondary" onClick={() => signOut({ callbackUrl: "/" })}>
      Déconnexion
    </Button>
  );
}
