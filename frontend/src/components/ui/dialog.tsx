import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;
const DialogPortal = DialogPrimitive.Portal;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "dialog-overlay fixed inset-0 z-50 bg-[#050704]/75 backdrop-blur-[3px]",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = "DialogOverlay";

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    showClose?: boolean;
  }
>(({ className, children, showClose = true, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "dialog-content fixed left-1/2 top-1/2 z-50 grid max-h-[calc(100dvh_-_1.5rem_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] w-[calc(100%-1.5rem)] max-w-lg min-w-0 grid-cols-[minmax(0,1fr)] gap-5 overflow-y-auto overflow-x-hidden overscroll-contain rounded-xl border border-line-strong bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-float sm:max-h-[min(88dvh,56rem)] sm:p-6",
        className,
      )}
      {...props}
    >
      {children}
      {showClose ? (
        <DialogPrimitive.Close
          className="absolute right-2.5 top-2.5 grid size-11 place-items-center rounded-md text-faint transition-colors hover:bg-raised hover:text-foreground pointer-fine:right-4 pointer-fine:top-4 pointer-fine:size-8"
          aria-label="Close dialog"
        >
          <X className="size-4" />
        </DialogPrimitive.Close>
      ) : null}
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = "DialogContent";

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex min-w-0 flex-col gap-1.5 pr-10 sm:pr-8", className)} {...props} />
);

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "sticky bottom-0 z-10 -mx-5 flex min-w-0 flex-col-reverse gap-2 border-t border-line bg-surface px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:mx-0 sm:flex-row sm:justify-end sm:bg-surface sm:px-0 sm:pt-5",
      className,
    )}
    {...props}
  />
);

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("font-display text-2xl leading-tight text-foreground", className)}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("break-words text-sm leading-relaxed text-muted", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
