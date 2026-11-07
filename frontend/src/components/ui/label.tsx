import * as React from "react";

import { cn } from "@/lib/utils";

const Label = React.forwardRef<
  HTMLLabelElement,
  React.ComponentPropsWithoutRef<"label">
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "mb-2 flex items-center justify-between gap-3 text-xs font-medium text-foreground",
      className,
    )}
    {...props}
  />
));
Label.displayName = "Label";

const Hint = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <p className={cn("mt-2 text-xs leading-relaxed text-faint", className)}>{children}</p>
);

const FieldError = ({ children }: { children: React.ReactNode }) => (
  <p role="alert" className="mt-2 text-xs leading-relaxed text-danger">
    {children}
  </p>
);

export { FieldError, Hint, Label };
