import { cn } from "@/lib/utils";
import { AlertCircle } from "lucide-react";

interface PriorityBadgeProps {
  priority?: number;
  className?: string;
}

export default function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  if (!priority) return null;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <AlertCircle className="w-4 h-4 text-warning" />
      <span className="px-2 py-1 rounded-full text-xs font-bold bg-warning/10 text-warning border border-warning/20">
        P{priority}
      </span>
    </div>
  );
}
