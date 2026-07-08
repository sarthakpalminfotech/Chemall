import { ReactNode } from "react";
import { useLocation, Navigate, Link } from "react-router-dom";
import { useStore } from "@/lib/store";
import { useMemo } from "react";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import { FlaskConical, Bell } from "lucide-react";

interface AppLayoutProps {
  children: ReactNode;
}

const pathModuleMap: Record<string, string> = {
  "/": "Dashboard",
  "/orders": "Orders",
  "/inventory": "Inventory",
  "/leads": "Leads",
  "/masters": "Masters",
  "/notes": "Notes",
  "/logs": "Logs",
};

export default function AppLayout({ children }: AppLayoutProps) {
  const { currentUser, alerts, inventory, products, isOwnerAdmin } = useStore();
  const location = useLocation();
  
  const unreadAlertsCount = useMemo(() => {
    const hasAccess = (moduleName: string) => {
      if (isOwnerAdmin()) return true;
      if (currentUser?.designation === "sales" && moduleName === "Orders") return false;
      const access = currentUser?.moduleAccess.find(m => m.moduleName === moduleName);
      return access?.write === true;
    };

    const unreadDbAlerts = alerts.filter(a => {
      if (a.read) return false;
      switch (a.type) {
        case "low_stock": return hasAccess("Inventory");
        case "order_unattended":
        case "no_dispatch":
        case "priority_unattended":
        case "repeat_customer_order": return hasAccess("Orders");
        case "lead_alert": return hasAccess("Leads");
        default: return true;
      }
    }).length;

    const lowStockCount = hasAccess("Inventory") ? inventory.filter((item) => {
      const product = products.find((p) => p.id === item.productId);
      const threshold = product?.alertThreshold ?? 100;
      return item.quantity < threshold;
    }).length : 0;
    
    return unreadDbAlerts + lowStockCount;
  }, [alerts, inventory, products, currentUser, isOwnerAdmin]);

  const hasRouteAccess = useMemo(() => {
    if (!currentUser) return false;
    if (isOwnerAdmin()) return true;
    if (location.pathname === "/scan-qr" || location.pathname === "/profile" || location.pathname === "/alerts" || location.pathname === "/login") return true;
    
    const matchedPath = Object.keys(pathModuleMap).find(p => 
      p === "/" ? location.pathname === "/" : location.pathname.startsWith(p)
    );
    if (!matchedPath) return true;

    const moduleName = pathModuleMap[matchedPath];
    const access = currentUser?.moduleAccess.find(m => m.moduleName === moduleName);
    return access?.read === true;
  }, [location.pathname, currentUser, isOwnerAdmin]);

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (!hasRouteAccess) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:block md:w-64 border-r border-border flex-shrink-0 print:hidden">
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm px-4 md:px-6 flex items-center justify-between flex-shrink-0 z-10 print:hidden">
          {/* Mobile: brand name */}
          <div className="flex items-center gap-2 md:hidden">
            <div className="w-7 h-7 bg-gradient-to-br from-primary to-blue-400 rounded-md flex items-center justify-center">
              <FlaskConical className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-foreground">Chemall Pro</span>
          </div>

          {/* Desktop: page title placeholder (pages render their own h1) */}
          <div className="hidden md:block" />

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <Link to="/alerts" className="relative w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors">
              <Bell className="w-4.5 h-4.5" />
              {unreadAlertsCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full" />}
            </Link>
            <Link to="/profile" className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden hover:opacity-80 transition-opacity">
              <span className="text-xs font-bold text-primary">{currentUser?.name?.[0]?.toUpperCase()}</span>
            </Link>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto">
          <div className="pb-20 md:pb-0 min-h-full">{children}</div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-card/95 backdrop-blur-sm z-40 print:hidden">
        <BottomNav />
      </div>
    </div>
  );
}
