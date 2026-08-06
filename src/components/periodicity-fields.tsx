"use client";

import { useState } from "react";
import { Input, Label, Select } from "@/components/ui";

export function PeriodicityFields() {
  const [type, setType] = useState<"weekday" | "every_n_days">("weekday");

  return (
    <>
      <div className="sm:col-span-2">
        <Label>Périodicité</Label>
        <Select
          name="periodicityType"
          value={type}
          onChange={(e) => setType(e.target.value as "weekday" | "every_n_days")}
        >
          <option value="weekday">Jour de semaine fixe</option>
          <option value="every_n_days">Tous les N jours</option>
        </Select>
      </div>
      {type === "weekday" ? (
        <div className="sm:col-span-2">
          <Label>Jour de séance</Label>
          <Select name="weekday" defaultValue="0">
            <option value="0">Dimanche</option>
            <option value="1">Lundi</option>
            <option value="2">Mardi</option>
            <option value="3">Mercredi</option>
            <option value="4">Jeudi</option>
            <option value="5">Vendredi</option>
            <option value="6">Samedi</option>
          </Select>
        </div>
      ) : (
        <div className="sm:col-span-2">
          <Label>Intervalle (jours)</Label>
          <Input name="intervalDays" type="number" required min={1} defaultValue={10} />
        </div>
      )}
    </>
  );
}
