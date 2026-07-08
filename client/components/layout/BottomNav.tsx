import { Link, useLocation } from "react-router-dom";
import { useStore } from "@/lib/store";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Settings,
  StickyNote,
  Zap,
  MoreHorizontal,
  QrCode,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const navigationItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { path: "/orders", label: "Orders", icon: ShoppingCart },
  { path: "/inventory", label: "Inventory", icon: Package },
  { path: "/leads", label: "Leads", icon: Zap },
  { path: "/masters", label: "Masters", icon: Settings },
  { path: "/notes", label: "Notes", icon: StickyNote },
  { path: "/scan-qr", label: "Scan QR", icon: QrCode },
  { path: "/logs", label: "Logs", icon: History },
];

export default function BottomNav() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { currentUser, isOwnerAdmin } = useStore();

  const accessibleItems = navigationItems.filter(item => {
    if (isOwnerAdmin()) return true;
    if (item.label === "Scan QR") return true;
    if (!currentUser) return false;
    const access = currentUser.moduleAccess.find(m => m.moduleName === item.label);
    return access?.read === true;
  });

  const visibleItems = accessibleItems.slice(0, 4);
  const moreItems = accessibleItems.slice(4);

  const isActive = (item: typeof navigationItems[0]) =>
    item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);

  return (
    <div className="flex items-center justify-around h-16 px-2">
      {visibleItems.map((item) => {
        const Icon = item.icon;
        const active = isActive(item);
        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-colors flex-1",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className={cn("w-5 h-5", active && "stroke-[2.5]")} />
            <span className={cn("text-[10px] font-medium", active && "text-primary")}>{item.label}</span>
          </Link>
        );
      })}

      {/* More Menu */}
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl text-muted-foreground hover:text-foreground transition-colors">
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 mb-2">
          {moreItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <DropdownMenuItem
                key={item.path}
                asChild
                disabled={item.disabled}
                className={cn(active && "bg-secondary")}
              >
                <Link
                  to={item.path}
                  className="flex items-center gap-2 cursor-pointer"
                  onClick={(e) => {
                    if (item.disabled) e.preventDefault();
                    setMenuOpen(false);
                  }}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  {item.comingSoon && (
                    <span className="text-xs text-muted-foreground ml-auto">Soon</span>
                  )}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
