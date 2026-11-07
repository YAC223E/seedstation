import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-md border border-line bg-background/45 px-3 text-base text-foreground shadow-[inset_0_1px_2px_rgb(0_0_0/0.08)] transition-colors placeholder:text-faint hover:border-line-strong focus:border-primary/55 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 pointer-fine:h-10 pointer-fine:text-sm",
        "file:mr-3 file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-foreground",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
