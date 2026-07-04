"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  treeId: string;
  currentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRenamed: () => void;
}

export function RenameTreeDialog({ treeId, currentName, open, onOpenChange, onRenamed }: Props) {
  const t = useTranslations("tree");
  const tc = useTranslations("common");
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const unchangedOrEmpty = trimmed === "" || trimmed === currentName;

  async function handleSave() {
    if (unchangedOrEmpty) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/trees/${treeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: trimmed }),
    });
    if (res.ok) {
      onRenamed();
      onOpenChange(false);
    } else {
      setError(t("renameError"));
    }
    setSaving(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setName(currentName);
          setError(null);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("renameTree")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="renameTreeName">{t("treeName")}</Label>
            <Input
              id="renameTreeName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              {tc("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving || unchangedOrEmpty}>
              {saving ? tc("saving") : tc("save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
