import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-[background-color,border-color,color,transform,opacity] duration-150 disabled:pointer-events-none disabled:opacity-45 active:translate-y-px [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:brightness-105 shadow-[inset_0_1px_0_rgb(255_255_255/0.18)]",
        outline:
          "border border-line-strong bg-transparent text-foreground hover:border-foreground/45 hover:bg-raised",
        secondary:
          "border border-transparent bg-raised text-foreground hover:border-line-strong",
        ghost: "text-muted hover:bg-raised hover:text-foreground",
        destructive:
          "border border-danger/30 bg-danger/10 text-danger hover:bg-danger/20 hover:border-danger/45",
        link: "h-auto rounded-none p-0 text-foreground underline decoration-line-strong underline-offset-4 hover:decoration-primary",
      },
      size: {
        // Touch-first sizes; only fine pointers get compact controls. Width
        // breakpoints alone are wrong here: a phone in landscape is ~844px.
        default: "h-11 px-4 text-sm pointer-fine:h-10",
        sm: "h-11 gap-1.5 px-3 text-xs pointer-fine:h-8",
        lg: "h-12 px-5 text-sm pointer-fine:h-11",
        icon: "size-11 pointer-fine:size-10",
        "icon-sm": "size-11 pointer-fine:size-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
