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
  treeName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

export function DeleteTreeDialog({ treeId, treeName, open, onOpenChange, onDeleted }: Props) {
  const t = useTranslations("tree");
  const tc = useTranslations("common");
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/trees/${treeId}`, { method: "DELETE" });
    if (res.ok) {
      setTyped("");
      onDeleted();
      onOpenChange(false);
    } else {
      setError(t("deleteError"));
    }
    setDeleting(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setTyped("");
          setError(null);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("deleteTree")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t("deleteTreeWarning", { name: treeName })}
          </p>
          <div className="space-y-1">
            <Label htmlFor="confirmTreeName">{t("deleteTreeTypeName")}</Label>
            <Input
              id="confirmTreeName"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={treeName}
              autoComplete="off"
            />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
              {tc("cancel")}
            </Button>
            <Button
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:border-red-300"
              onClick={handleDelete}
              disabled={typed !== treeName || deleting}
            >
              {deleting ? tc("deleting") : tc("delete")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
