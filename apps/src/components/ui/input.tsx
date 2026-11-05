import * as React from "react";
import { cn } from "../../lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex h-8 w-full rounded-lg border border-neutral-700/80 bg-neutral-900/90 px-3 py-1.5 text-xs text-white placeholder:text-neutral-500 transition-colors file:border-0 file:bg-transparent file:text-xs file:font-medium focus-visible:outline-none focus-visible:border-neutral-500 shadow-sm disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };

