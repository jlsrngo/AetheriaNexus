import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "secondary",
  size = "md",
  children,
  className = "",
  disabled,
  ...rest
}) => {
  const base =
    "relative inline-flex items-center justify-center font-mono font-bold uppercase tracking-wider transition-colors rounded-none border disabled:opacity-50 disabled:pointer-events-none";

  const sizeClasses = {
    sm: "text-[11px] px-2.5 py-1.5 gap-1.5",
    md: "text-xs px-3.5 py-2.5 gap-2",
    lg: "text-xs px-5 py-3 gap-2.5",
  };

  const variants = {
    primary:
      "bg-white text-black border-white hover:bg-neutral-200 active:bg-neutral-300 font-extrabold shadow-sm",
    secondary:
      "bg-neutral-900 text-neutral-200 border-neutral-700 hover:bg-neutral-800 hover:border-neutral-500 hover:text-white",
    danger:
      "bg-rose-600 text-white border-rose-500 hover:bg-rose-700",
    ghost:
      "bg-transparent text-neutral-400 border-transparent hover:text-white hover:bg-neutral-800/60",
  };

  return (
    <button
      className={`${base} ${sizeClasses[size]} ${variants[variant]} ${className}`}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
};

