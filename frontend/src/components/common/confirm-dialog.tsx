import { LoaderCircle, Trash2 } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  confirmPhrase = "DELETE",
  busy = false,
  error,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  confirmPhrase?: string;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void;
  children?: ReactNode;
}) {
  const [typed, setTyped] = useState("");
  const inputId = useId();

  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  const canConfirm = typed.trim() === confirmPhrase;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <DialogContent
        className="max-w-md"
        aria-busy={busy}
        onOpenAutoFocus={(event) => {
          // Opening the keyboard immediately on a phone hides the footer and
          // the confirm phrase field is usually not the first thing users need.
          if (window.matchMedia("(pointer: coarse)").matches) {
            event.preventDefault();
            (event.currentTarget as HTMLElement | null)?.focus();
          }
        }}
      >
        <DialogHeader>
          <span className="mb-1 grid size-9 place-items-center rounded-full border border-danger/25 bg-danger/10 text-danger">
            <Trash2 className="size-4" />
          </span>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {children}

        <div>
          <Label htmlFor={inputId} className="text-xs text-muted">
            <span>
              Type <span className="data text-foreground">{confirmPhrase}</span> to confirm
            </span>
          </Label>
          <Input
            id={inputId}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            enterKeyHint="done"
            spellCheck={false}
            placeholder={confirmPhrase}
            className="mt-2"
            onKeyDown={(event) => {
              if (event.key === "Enter" && canConfirm && !busy) onConfirm();
            }}
          />
          {error ? (
            <p role="alert" className="mt-2 text-xs text-danger">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={!canConfirm || busy}
            aria-busy={busy}
          >
            {busy ? (
              <>
                <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                Removing…
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
