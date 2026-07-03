import { Alert as AlertType, AlertType as AlertKind } from "@/lib/types";
import {
  AlertCircle,
  TrendingDown,
  Clock,
  Zap,
  Users,
  Package as PackageIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface AlertCardProps {
  alert: AlertType;
}

export default function AlertCard({ alert }: AlertCardProps) {
  const getIcon = () => {
    switch (alert.type) {
      case "low_stock":
        return <TrendingDown className="w-5 h-5 text-warning" />;
      case "order_unattended":
        return <Clock className="w-5 h-5 text-warning" />;
      case "no_dispatch":
        return <PackageIcon className="w-5 h-5 text-destructive" />;
      case "priority_unattended":
        return <AlertCircle className="w-5 h-5 text-destructive" />;
      case "repeat_customer_order":
        return <Users className="w-5 h-5 text-warning" />;
      default:
        return <AlertCircle className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getTypeLabel = () => {
    const labels: Record<AlertKind, string> = {
      low_stock: "Low Stock",
      order_unattended: "Unattended Order",
      no_dispatch: "No Dispatch",
      priority_unattended: "Priority Alert",
      repeat_customer_order: "Repeat Order",
      other: "Alert",
    };
    return labels[alert.type];
  };

  const bgColor = alert.type === "no_dispatch" || alert.type === "priority_unattended"
    ? "bg-destructive/5 border-destructive/20 hover:bg-destructive/10"
    : "bg-warning/5 border-warning/20 hover:bg-warning/10";

  return (
    <div
      className={cn(
        "p-4 rounded-lg border transition-colors",
        bgColor,
        alert.read && "opacity-60"
      )}
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            {getTypeLabel()}
          </p>
          <p className="text-sm text-text-secondary mt-1 line-clamp-2">
            {alert.message}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            {formatDistanceToNow(alert.timestamp, { addSuffix: true })}
          </p>
        </div>
      </div>
    </div>
  );
}
