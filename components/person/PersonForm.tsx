"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
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
import { CloudinaryUpload } from "@/components/ui/cloudinary-upload";
import type { IPerson } from "@/types";

interface Props {
  initial?: Partial<IPerson>;
  onSubmit: (data: Partial<IPerson>) => void;
  loading?: boolean;
}

export function PersonForm({ initial = {}, onSubmit, loading }: Props) {
  const t = useTranslations("person");
  const tc = useTranslations("common");
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
          <Label>{t("firstName")} *</Label>
          <Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label>{t("lastName")} *</Label>
          <Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>{t("maidenName")}</Label>
          <Input value={form.maidenName ?? ""} onChange={(e) => set("maidenName", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{t("gender")}</Label>
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

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>
            {t("birthDate")}{" "}
            <span className="text-xs text-muted-foreground font-normal">
              — {tc("optional")}
            </span>
          </Label>
          <DateInput value={form.birthDate} onChange={(v) => set("birthDate", v)} placeholder={tc("year")} />
        </div>
        <div className="space-y-2">
          <Label>{t("birthPlace")}</Label>
          <Input value={form.birthPlace ?? ""} onChange={(e) => set("birthPlace", e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("godparentName")}</Label>
        <Input value={form.godparentName ?? ""} onChange={(e) => set("godparentName", e.target.value)} />
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
          <Label htmlFor="isDeceased" className="cursor-pointer">{t("deceased")}</Label>
        </div>

        {!form.isLiving && (
          <div className="pl-6 border-l-2 border-muted">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  {t("deathDate")}{" "}
                  <span className="text-xs text-muted-foreground font-normal">
                    — {tc("optional")}
                  </span>
                </Label>
                <DateInput value={form.deathDate} onChange={(v) => set("deathDate", v)} placeholder={tc("year")} />
              </div>
              <div className="space-y-2">
                <Label>{t("deathPlace")}</Label>
                <Input value={form.deathPlace ?? ""} onChange={(e) => set("deathPlace", e.target.value)} />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label>{t("photo")}</Label>
        <CloudinaryUpload
          mode="single"
          folder="genealogy/photos"
          value={form.photoUrl ?? ""}
          onChange={(url) => set("photoUrl", url)}
          accept="image/*"
        />
      </div>

      <div className="space-y-2">
        <Label>{t("notes")}</Label>
        <Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={3} />
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
