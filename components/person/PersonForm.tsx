"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { IPerson } from "@/types";

interface Props {
  initial?: Partial<IPerson>;
  onSubmit: (data: Partial<IPerson>) => void;
  loading?: boolean;
}

export function PersonForm({ initial = {}, onSubmit, loading }: Props) {
  const [form, setForm] = useState<Partial<IPerson>>({
    firstName: "",
    lastName: "",
    gender: "unknown",
    isLiving: true,
    ...initial,
  });

  const set = (k: keyof IPerson, v: unknown) =>
    setForm((p) => ({ ...p, [k]: v }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(form);
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>First name *</Label>
          <Input
            value={form.firstName}
            onChange={(e) => set("firstName", e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Last name *</Label>
          <Input
            value={form.lastName}
            onChange={(e) => set("lastName", e.target.value)}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Maiden name</Label>
          <Input
            value={form.maidenName ?? ""}
            onChange={(e) => set("maidenName", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Gender</Label>
          <Select
            value={form.gender}
            onValueChange={(v) => set("gender", v)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Birth date</Label>
          <Input
            type="date"
            value={form.birthDate ?? ""}
            onChange={(e) => set("birthDate", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Birth place</Label>
          <Input
            value={form.birthPlace ?? ""}
            onChange={(e) => set("birthPlace", e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Death date</Label>
          <Input
            type="date"
            value={form.deathDate ?? ""}
            onChange={(e) => set("deathDate", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Death place</Label>
          <Input
            value={form.deathPlace ?? ""}
            onChange={(e) => set("deathPlace", e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea
          value={form.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Saving..." : "Save person"}
      </Button>
    </form>
  );
}
