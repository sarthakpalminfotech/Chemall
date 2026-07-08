import { useStore } from "@/lib/store";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { formatDate } from "date-fns";
import { Button } from "@/components/ui/button";
import { Check, Package, Clock, Factory, AlertTriangle, TrendingUp, Users, Bell } from "lucide-react";

const alertConfig = {
  low_stock: { icon: Package, color: "text-warning", bg: "bg-warning/10", border: "border-warning/20", label: "Low Stock" },
  order_unattended: { icon: Clock, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20", label: "Order Unattended" },
  no_dispatch: { icon: Factory, color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20", label: "No Dispatch" },
  priority_unattended: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20", label: "Priority Alert" },
  repeat_customer_order: { icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20", label: "Repeat Order" },
  lead_alert: { icon: Users, color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20", label: "Lead Alert" },
  other: { icon: Bell, color: "text-muted-foreground", bg: "bg-secondary", border: "border-border", label: "Alert" },
};

export default function Alerts() {
  const { alerts, inventory, products, clearAllAlerts, markAlertRead, currentUser, isOwnerAdmin } = useStore();
  const navigate = useNavigate();

  const hasAccess = (moduleName: string) => {
    if (isOwnerAdmin()) return true;
    const access = currentUser?.moduleAccess.find(m => m.moduleName === moduleName);
    return access?.read === true || access?.write === true;
  };

  const lowStockAlerts = useMemo(() => {
    return inventory
      .map((item) => {
        const product = products.find((p) => p.id === item.productId);
        const threshold = product?.alertThreshold ?? 100;
        if (item.quantity < threshold) {
          return {
            id: `low-stock-${item.productId}`,
            type: "low_stock" as const,
            title: "Low Stock Alert",
            message: `${item.productName} is running low. Current stock: ${item.quantity.toLocaleString()} kg (Threshold: ${threshold} kg)`,
            timestamp: item.lastUpdated,
            read: false,
          };
        }
        return null;
      })
      .filter(Boolean) as any[];
  }, [inventory, products]);

  const allAlerts = [...lowStockAlerts, ...alerts].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const sortedAlerts = allAlerts.filter(alert => {
    switch (alert.type) {
      case "low_stock": return hasAccess("Inventory");
      case "order_unattended":
      case "no_dispatch":
      case "priority_unattended":
      case "repeat_customer_order": return hasAccess("Orders");
      case "lead_alert": return hasAccess("Leads");
      default: return true;
    }
  });

  return (
    <div className="w-full max-w-3xl mx-auto px-4 md:px-6 pt-6 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Alerts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your notifications and alerts</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => clearAllAlerts()} className="gap-2">
          <Check className="w-4 h-4" />
          Clear All
        </Button>
      </div>

      {sortedAlerts.length === 0 ? (
        <div className="card-elevated p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center mb-4">
            <Bell className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-lg font-medium text-foreground">All caught up!</p>
          <p className="text-sm text-muted-foreground mt-1">You have no new alerts.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedAlerts.map((alert) => {
            const cfg = alertConfig[alert.type as keyof typeof alertConfig] || alertConfig.other;
            const Icon = cfg.icon;
            
            return (
              <div
                key={alert.id}
                className={`card-elevated p-4 border cursor-pointer hover:shadow-md transition-all duration-200 ${cfg.border} ${!alert.read ? "ring-1 ring-inset ring-primary/20 bg-card hover:border-primary/50" : "bg-secondary/20 hover:border-border/80"}`}
                onClick={() => {
                  if (!alert.read && !alert.id.startsWith("low-stock")) {
                    markAlertRead(alert.id);
                  }
                  
                  if (alert.type === "low_stock") {
                    navigate("/inventory");
                  } else if (
                    alert.type === "order_unattended" || 
                    alert.type === "no_dispatch" || 
                    alert.type === "priority_unattended" || 
                    alert.type === "repeat_customer_order"
                  ) {
                    navigate(alert.relatedOrderId ? `/orders/${alert.relatedOrderId}` : "/orders");
                  } else if (alert.type === "lead_alert") {
                    navigate(alert.relatedLeadId ? `/leads/${alert.relatedLeadId}` : "/leads");
                  }
                }}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-5 h-5 ${cfg.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm font-semibold leading-snug ${!alert.read ? "text-foreground" : "text-foreground/80"}`}>
                        {alert.title}
                      </p>
                      {!alert.read && (
                        <span className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0 mt-1 shadow-sm shadow-primary/20" />
                      )}
                    </div>
                    <p className={`text-sm mt-1 leading-relaxed ${!alert.read ? "text-muted-foreground" : "text-muted-foreground/70"}`}>
                      {alert.message}
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-2 font-medium">
                      {formatDate(new Date(alert.timestamp), "dd MMM, yyyy · HH:mm")}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
