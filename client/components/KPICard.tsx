import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KPICardProps {
  label: string;
  value: string | number;
  trend?: "up" | "down";
  trendValue?: number;
  icon?: React.ReactNode;
  comingSoon?: boolean;
  className?: string;
}

export default function KPICard({
  label,
  value,
  trend,
  trendValue,
  icon,
  comingSoon = false,
  className,
}: KPICardProps) {
  return (
    <div
      className={cn(
        "p-6 rounded-lg border border-border bg-card",
        comingSoon && "opacity-50 pointer-events-none",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          {comingSoon ? (
            <p className="text-2xl font-bold text-foreground mt-2">Coming Soon</p>
          ) : (
            <>
              <p className="text-3xl font-bold text-foreground mt-2">{value}</p>
              {trend && trendValue && (
                <div className="flex items-center gap-1 mt-2">
                  {trend === "up" ? (
                    <TrendingUp className="w-4 h-4 text-success" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-destructive" />
                  )}
                  <span
                    className={cn(
                      "text-sm font-medium",
                      trend === "up" ? "text-success" : "text-destructive"
                    )}
                  >
                    {trendValue}% this month
                  </span>
                </div>
              )}
            </>
          )}
        </div>
        {icon && <div className="flex-shrink-0">{icon}</div>}
      </div>
    </div>
  );
}
