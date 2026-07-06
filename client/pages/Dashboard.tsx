import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ShoppingCart,
  Factory,
  AlertTriangle,
  TrendingUp,
  Users,
  Zap,
  Package,
  Clock,
  Bell,
  ArrowRight,
} from "lucide-react";
import { formatDate } from "date-fns";
import { Link } from "react-router-dom";

// ─── Alert icon map ────────────────────────────────────────────────────────────
const alertConfig = {
  low_stock: { icon: Package, color: "text-warning", bg: "bg-warning/10", border: "border-warning/20", label: "Low Stock" },
  order_unattended: { icon: Clock, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20", label: "Order Unattended" },
  no_dispatch: { icon: Factory, color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/20", label: "No Dispatch" },
  priority_unattended: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/20", label: "Priority Alert" },
  repeat_customer_order: { icon: TrendingUp, color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/20", label: "Repeat Order" },
  lead_alert: { icon: Users, color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/20", label: "Lead Alert" },
  other: { icon: Bell, color: "text-muted-foreground", bg: "bg-secondary", border: "border-border", label: "Alert" },
};

// ─── Custom Tooltip ─────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-sm font-bold text-foreground">{payload[0].value.toLocaleString()} kg</p>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const { orders, alerts, inventory, inventoryLogs, suppliers, products, leads } = useStore();
  const [dispatchView, setDispatchView] = useState<"monthly" | "weekly">("monthly");
  
  const [dateFilter, setDateFilter] = useState<"today" | "week" | "month" | "custom">("today");
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  // ─── KPIs ────────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const isWithinDateRange = (dateString: string | Date) => {
      const d = new Date(dateString);
      d.setHours(0, 0, 0, 0);
  
      const today = new Date();
      today.setHours(0, 0, 0, 0);
  
      if (dateFilter === "today") {
        return d.getTime() === today.getTime();
      }
      
      if (dateFilter === "week") {
        const firstDayOfWeek = new Date(today);
        firstDayOfWeek.setDate(today.getDate() - today.getDay());
        return d >= firstDayOfWeek;
      }
      
      if (dateFilter === "month") {
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        return d >= monthStart;
      }
      
      if (dateFilter === "custom") {
        if (!customStartDate || !customEndDate) return true;
        const start = new Date(customStartDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        return d >= start && d <= end;
      }
      return true;
    };

    const pendingOrders = orders.filter((o) => o.status === "pending" && isWithinDateRange(o.date)).length;
    const inProduction = orders.filter((o) => o.status === "in_production" && isWithinDateRange(o.date)).length;

    // Dispatch for selected period
    const dispatchQty = inventoryLogs
      .filter((l) => l.type === "OUT" && isWithinDateRange(l.date))
      .reduce((sum, l) => sum + l.quantity, 0);

    // New customers
    const newCustomers = suppliers.filter((s) => s.type === "customer" && isWithinDateRange(s.createdAt)).length;

    // New leads
    const newLeadsCount = leads.filter(l => l.status === "new" && isWithinDateRange(l.createdAt)).length;

    return { pendingOrders, inProduction, dispatchQty, newCustomers, newLeadsCount };
  }, [orders, inventoryLogs, suppliers, leads, dateFilter, customStartDate, customEndDate]);

  // ─── Dispatch Chart Data ─────────────────────────────────────────────────────
  const dispatchData = useMemo(() => {
    const outLogs = inventoryLogs.filter((l) => l.type === "OUT");

    if (dispatchView === "weekly") {
      const today = new Date();
      const days: { label: string; value: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dayStr = i === 0 ? "Today" : formatDate(d, "EEE d");
        const qty = outLogs
          .filter((l) => {
            const ld = new Date(l.date);
            return (
              ld.getDate() === d.getDate() &&
              ld.getMonth() === d.getMonth() &&
              ld.getFullYear() === d.getFullYear()
            );
          })
          .reduce((sum, l) => sum + l.quantity, 0);
        days.push({ label: dayStr, value: qty });
      }
      return days;
    } else {
      // Monthly: last 12 months
      const today = new Date();
      const months: { label: string; value: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const label = formatDate(d, "MMM");
        const qty = outLogs
          .filter((l) => {
            const ld = new Date(l.date);
            return ld.getMonth() === d.getMonth() && ld.getFullYear() === d.getFullYear();
          })
          .reduce((sum, l) => sum + l.quantity, 0);
        months.push({ label, value: qty });
      }
      return months;
    }
  }, [inventoryLogs, dispatchView]);

  // Generate low stock alerts dynamically
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

  const sortedAlerts = [...lowStockAlerts, ...alerts].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="w-full">
      {/* ─── Page Header & Global Filter ─────────────────────────────────────────────────── */}
      <div className="px-4 md:px-6 pt-6 pb-4">
        <div className="flex items-start md:items-center justify-between gap-2">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
              {formatDate(new Date(), "EEEE, dd MMMM yyyy")}
            </p>
          </div>
          
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <Select value={dateFilter} onValueChange={(v: any) => setDateFilter(v)}>
              <SelectTrigger className="w-[100px] sm:w-[130px] md:w-36 h-9 text-xs sm:text-sm bg-card shadow-sm border-border/60">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="custom">Custom Date</SelectItem>
              </SelectContent>
            </Select>

            <Link
              to="/orders/new"
              className="inline-flex items-center justify-center w-9 h-9 md:w-auto md:h-auto md:px-4 md:py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors shadow-sm shrink-0"
            >
              <ShoppingCart className="w-[18px] h-[18px] md:w-4 md:h-4" />
              <span className="hidden md:inline ml-2">New Order</span>
            </Link>
          </div>
        </div>
        
        {dateFilter === "custom" && (
          <div className="flex items-center gap-2 mt-4 justify-end">
            <input
              type="date"
              className="h-9 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-full max-w-[140px]"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
            />
            <span className="text-muted-foreground text-sm">to</span>
            <input
              type="date"
              className="h-9 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-full max-w-[140px]"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="px-4 md:px-6 space-y-6 pb-8">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 md:gap-4">
          {/* New Leads */}
          <div className="kpi-card col-span-1 flex flex-col gap-1.5 md:gap-2 relative overflow-hidden">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 md:w-5 md:h-5 text-emerald-500" />
            </div>
            <div className="mt-1 md:mt-2">
              <p className="text-[13px] md:text-sm text-muted-foreground font-medium line-clamp-1">New Leads</p>
              <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1">{kpis.newLeadsCount}</p>
            </div>
          </div>

          {/* New Customers */}
          <div className="kpi-card col-span-1 flex flex-col gap-1.5 md:gap-2">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 md:w-5 md:h-5 text-blue-500" />
            </div>
            <div className="mt-1 md:mt-2">
              <p className="text-[13px] md:text-sm text-muted-foreground font-medium line-clamp-1">New Customers</p>
              <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1">
                {kpis.newCustomers}
              </p>
            </div>
          </div>

          {/* Pending Orders */}
          <div className="kpi-card col-span-1 flex flex-col gap-1.5 md:gap-2">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-4 h-4 md:w-5 md:h-5 text-warning" />
            </div>
            <div className="mt-1 md:mt-2">
              <p className="text-[13px] md:text-sm text-muted-foreground font-medium line-clamp-1">Pending Orders</p>
              <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1">{kpis.pendingOrders}</p>
            </div>
          </div>

          {/* In Production */}
          <div className="kpi-card col-span-1 flex flex-col gap-1.5 md:gap-2">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
              <Factory className="w-4 h-4 md:w-5 md:h-5 text-success" />
            </div>
            <div className="mt-1 md:mt-2">
              <p className="text-[13px] md:text-sm text-muted-foreground font-medium line-clamp-1">In Production</p>
              <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1">{kpis.inProduction}</p>
            </div>
          </div>

          {/* Dispatch */}
          <div className="kpi-card col-span-1 flex flex-col gap-1.5 md:gap-2">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            </div>
            <div className="mt-1 md:mt-2">
              <p className="text-[13px] md:text-sm text-muted-foreground font-medium line-clamp-1">Dispatched Qty</p>
              <p className="text-2xl md:text-3xl font-bold text-foreground mt-0.5 md:mt-1">
                {kpis.dispatchQty > 0 ? `${kpis.dispatchQty.toLocaleString()} kg` : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* ─── Alerts + Chart ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 md:gap-6">
          {/* Alerts Feed */}
          <div className="xl:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Recent Alerts</h2>
              <button className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-2">
              {sortedAlerts.slice(0, 6).map((alert) => {
                const cfg = alertConfig[alert.type] || alertConfig.other;
                const Icon = cfg.icon;
                return (
                  <div
                    key={alert.id}
                    className={`alert-card border ${cfg.border} ${!alert.read ? "ring-1 ring-inset ring-primary/10" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <Icon className={`w-4 h-4 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground leading-snug">
                            {alert.title}
                          </p>
                          {!alert.read && (
                            <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                          {alert.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                          {formatDate(new Date(alert.timestamp), "dd MMM · HH:mm")}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dispatch Chart */}
          <div className="xl:col-span-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="section-title">Dispatch Summary</h2>
              <Select value={dispatchView} onValueChange={(v: any) => setDispatchView(v)}>
                <SelectTrigger className="w-36 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Month-wise</SelectItem>
                  <SelectItem value="weekly">This Week</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="card-elevated p-4 md:p-6">
              {/* Mobile horizontal scroll for monthly */}
              {dispatchView === "monthly" && (
                <div className="md:hidden overflow-x-auto pb-2">
                  <div style={{ minWidth: 520 }}>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={dispatchData} barSize={24}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={50} tickFormatter={(v) => v === 0 ? "0" : `${v/1000}k`} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--secondary))" }} />
                        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Desktop full width */}
              <div className="hidden md:block">
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dispatchData} barSize={dispatchView === "weekly" ? 32 : 28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={56} tickFormatter={(v) => v === 0 ? "0" : `${(v/1000).toFixed(v >= 1000 ? 1 : 0)}k`} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--secondary))" }} />
                    <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Mobile weekly view */}
              {dispatchView === "weekly" && (
                <div className="md:hidden">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={dispatchData} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={46} tickFormatter={(v) => v === 0 ? "0" : `${v/1000}k`} />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--secondary))" }} />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                <span>Total dispatched qty (kg) from production events</span>
                <span className="font-medium text-foreground">
                  {dispatchData.reduce((s, d) => s + d.value, 0).toLocaleString()} kg
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
