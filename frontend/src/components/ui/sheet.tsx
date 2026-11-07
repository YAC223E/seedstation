import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetTitle = DialogPrimitive.Title;
const SheetDescription = DialogPrimitive.Description;

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="dialog-overlay fixed inset-0 z-50 bg-[#050704]/70 backdrop-blur-[3px]" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "sheet-content fixed inset-y-0 right-0 z-50 flex w-full max-w-[34rem] flex-col border-l border-line-strong bg-surface pb-[env(safe-area-inset-bottom)] shadow-float outline-none",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className="absolute right-2.5 top-[max(0.625rem,env(safe-area-inset-top))] grid size-11 place-items-center rounded-md text-faint transition-colors hover:bg-raised hover:text-foreground sm:right-4 sm:top-4 pointer-fine:size-9"
        aria-label="Close panel"
      >
        <X className="size-4" />
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = "SheetContent";

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetTitle, SheetTrigger };
