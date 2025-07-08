import * as React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-lg border bg-background shadow-sm p-6 transition-colors hover:bg-accent",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card"; 