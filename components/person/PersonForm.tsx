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
import { Checkbox } from "@/components/ui/checkbox";
import { DateInput } from "@/components/ui/date-input";
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
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>First name *</Label>
          <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>Last name *</Label>
          <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Maiden name</Label>
          <Input value={form.maidenName ?? ""} onChange={(e) => set("maidenName", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Gender</Label>
          <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
              <SelectItem value="unknown">Unknown</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>
          Birth date{" "}
          <span className="text-xs text-muted-foreground font-normal">
            — optional, year only is fine
          </span>
        </Label>
        <DateInput value={form.birthDate} onChange={(v) => set("birthDate", v)} placeholder="Year or ~Year" />
      </div>

      <div className="space-y-2">
        <Label>Birth place</Label>
        <Input value={form.birthPlace ?? ""} onChange={(e) => set("birthPlace", e.target.value)} />
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="isDeceased"
            checked={!form.isLiving}
            onCheckedChange={(checked) => {
              if (checked === true) {
                set("isLiving", false);
              } else {
                setForm((p) => ({ ...p, isLiving: true, deathDate: undefined, deathPlace: undefined }));
              }
            }}
          />
          <Label htmlFor="isDeceased" className="cursor-pointer">Deceased</Label>
        </div>

        {!form.isLiving && (
          <div className="space-y-3 pl-6 border-l-2 border-muted">
            <div className="space-y-2">
              <Label>
                Death date{" "}
                <span className="text-xs text-muted-foreground font-normal">
                  — optional, year only is fine
                </span>
              </Label>
              <DateInput
                value={form.deathDate}
                onChange={(v) => set("deathDate", v)}
                placeholder="Year or ~Year"
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
        )}
      </div>

      <div className="space-y-2">
        <Label>Photo URL</Label>
        <Input type="url" placeholder="https://…" value={form.photoUrl ?? ""} onChange={(e) => set("photoUrl", e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Notes</Label>
        <Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={3} />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Saving..." : "Save person"}
      </Button>
    </form>
  );
}
