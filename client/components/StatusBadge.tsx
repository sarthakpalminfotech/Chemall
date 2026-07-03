import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "pending" | "in_production";
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const variants = {
    pending: "bg-warning/10 text-warning border border-warning/20",
    in_production: "bg-success/10 text-success border border-success/20",
  };

  const labels = {
    pending: "Pending",
    in_production: "In Production",
  };

  return (
    <span
      className={cn(
        "px-3 py-1 rounded-full text-sm font-medium inline-block",
        variants[status],
        className
      )}
    >
      {labels[status]}
    </span>
  );
}
