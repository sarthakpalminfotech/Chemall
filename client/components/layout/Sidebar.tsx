import { Link, useLocation, useNavigate } from "react-router-dom";
import { useStore } from "@/lib/store";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Settings,
  StickyNote,
  Zap,
  FlaskConical,
  QrCode,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigationItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/orders", label: "Orders", icon: ShoppingCart },
  { path: "/inventory", label: "Inventory", icon: Package },
  { path: "/leads", label: "Leads", icon: Zap },
  { path: "/masters", label: "Masters", icon: Settings },
  { path: "/notes", label: "Notes", icon: StickyNote },
  { path: "/scan-qr", label: "Scan QR", icon: QrCode },
  { path: "/logs", label: "Logs", icon: History },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, isOwnerAdmin, logout } = useStore();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Filter items based on access
  const visibleItems = navigationItems.filter(item => {
    if (isOwnerAdmin()) return true;
    if (item.label === "Scan QR") return true; // Assuming everyone can scan QR
    if (!currentUser) return false;
    const access = currentUser.moduleAccess.find(m => m.moduleName === item.label);
    return access?.read === true;
  });

  return (
    <div className="h-full flex flex-col bg-sidebar">
      {/* Logo Area */}
      <div className="h-16 flex items-center px-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-sidebar-primary to-blue-400 rounded-lg flex items-center justify-center shadow-md">
            <FlaskConical className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white leading-none">Chemall Pro</h2>
            <p className="text-[11px] text-sidebar-foreground mt-0.5 leading-none">Operations Hub</p>
          </div>
        </div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.path);
          const isDisabled = item.disabled;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                isDisabled
                  ? "text-sidebar-foreground/30 cursor-not-allowed opacity-50 pointer-events-none"
                  : isActive
                  ? "bg-sidebar-accent text-white"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
              onClick={(e) => isDisabled && e.preventDefault()}
            >
              <Icon
                className={cn(
                  "w-4.5 h-4.5 flex-shrink-0 transition-colors",
                  isActive ? "text-sidebar-primary" : "text-sidebar-foreground"
                )}
              />
              <span className="flex-1">{item.label}</span>
              {item.comingSoon && (
                <span className="text-[10px] px-1.5 py-0.5 bg-sidebar-accent/60 text-sidebar-foreground/60 rounded-md leading-none">
                  Soon
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="px-4 py-4 border-t border-sidebar-border">
        {currentUser && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-sidebar-primary/20 flex items-center justify-center">
                <span className="text-xs font-bold text-sidebar-primary">
                  {currentUser.name[0]?.toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-xs font-medium text-sidebar-accent-foreground">{currentUser.name}</p>
                <p className="text-[10px] text-sidebar-foreground/60 leading-none mt-0.5 capitalize">{currentUser.designation}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-1.5 text-sidebar-foreground/60 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent rounded-md transition-colors"
              title="Logout"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
