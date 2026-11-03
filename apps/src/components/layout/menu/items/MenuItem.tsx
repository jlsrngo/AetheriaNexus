import { memo, type ReactNode, type ComponentType, isValidElement } from "react";
import { Check } from "lucide-react";
import { cn } from "../../../../lib/utils";

interface MenuItemProps {
  icon?: ComponentType<{ className?: string; strokeWidth?: number }> | ReactNode;
  iconColor?: string;
  label: string;
  shortcut?: string;
  checked?: boolean;
  rightBadge?: ReactNode;
  rightIcon?: ComponentType<{ className?: string; strokeWidth?: number }>;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}

export const MenuItem = memo(function MenuItem({
  icon,
  label,
  shortcut,
  checked,
  rightBadge,
  rightIcon: RightIcon,
  disabled,
  onClick,
  className,
}: MenuItemProps) {
  const renderIcon = () => {
    if (!icon) return null;

    if (isValidElement(icon)) {
      return (
        <span className="w-4 h-4 flex items-center justify-center shrink-0 text-neutral-400 group-hover/menuitem:text-white">
          {icon}
        </span>
      );
    }
    if (
      typeof icon === "function" ||
      (typeof icon === "object" && icon !== null && "$$typeof" in icon)
    ) {
      const IconComponent = icon as ComponentType<{ className?: string; strokeWidth?: number }>;
      return (
        <IconComponent
          className="w-4 h-4 text-neutral-400 group-hover/menuitem:text-white shrink-0"
          strokeWidth={1.8}
        />
      );
    }
    return <span className="w-4 h-4 shrink-0">{icon}</span>;
  };

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "group/menuitem w-full px-3 py-1.5 text-xs font-mono flex items-center justify-between gap-3 whitespace-nowrap transition-none cursor-pointer rounded-none text-neutral-300 hover:bg-neutral-900 hover:text-white border-l-2 border-l-transparent hover:border-l-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed",
        className
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {checked !== undefined ? (
          <div className="w-4 h-4 flex items-center justify-center shrink-0">
            {checked && <Check className="w-3.5 h-3.5 text-emerald-400" strokeWidth={2.5} />}
          </div>
        ) : (
          renderIcon()
        )}
        <span className="truncate tracking-wide font-medium">{label}</span>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-auto pl-2">
        {rightBadge}
        {RightIcon && (
          <RightIcon className="w-3.5 h-3.5 text-neutral-500 group-hover/menuitem:text-neutral-300" strokeWidth={1.8} />
        )}
        {shortcut && (
          <kbd className="text-[10px] font-mono text-neutral-500 group-hover/menuitem:text-neutral-300 tracking-wider">
            {shortcut}
          </kbd>
        )}
      </div>
    </button>
  );
});
