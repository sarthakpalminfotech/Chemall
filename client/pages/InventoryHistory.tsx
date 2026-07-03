import { useState } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, TrendingDown, TrendingUp, Filter } from "lucide-react";
import { formatDate } from "date-fns";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function InventoryHistory() {
  const { products, inventoryLogs } = useStore();
  const [filters, setFilters] = useState({ dateFrom: "", dateTo: "", product: "", type: "all" });
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  const getLogType = (log: any) => {
    if (log.type === "IN") return "IN";
    if (log.type === "OUT" && log.reference && log.reference.startsWith("ORD-")) return "OUT(order)";
    return "OUT(manual)";
  };

  const filteredLogs = inventoryLogs
    .filter(log => {
      // Apply product filter
      if (filters.product && filters.product !== "all" && log.productId !== filters.product) return false;
      
      // Apply date filters
      if (filters.dateFrom && new Date(log.date) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo) {
        const to = new Date(filters.dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(log.date) > to) return false;
      }
      
      // Apply type filter
      if (filters.type !== "all") {
        const logType = getLogType(log);
        if (filters.type === "in" && logType !== "IN") return false;
        if (filters.type === "out_order" && logType !== "OUT(order)") return false;
        if (filters.type === "out_manual" && logType !== "OUT(manual)") return false;
      }
      
      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="w-full flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-background">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 flex items-center justify-between border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/inventory">
            <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full md:hidden">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
              <Link to="/inventory" className="hidden md:inline-flex">
                <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full -ml-2">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              Inventory History
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-0.5 ml-0 md:ml-8">View all IN and OUT logs</p>
          </div>
        </div>
        
        {/* Mobile Filter Toggle */}
        <Button 
          variant="outline" 
          size="sm" 
          className="md:hidden gap-2 h-8"
          onClick={() => setShowFiltersMobile(!showFiltersMobile)}
        >
          <Filter className="w-3.5 h-3.5" />
          Filters
        </Button>
      </div>

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Sidebar Filters (Desktop & Mobile) */}
        <div className={cn(
          "w-full md:w-64 border-b md:border-b-0 md:border-r border-border bg-card shrink-0 p-4 overflow-y-auto",
          showFiltersMobile ? "block" : "hidden md:block"
        )}>
          <h2 className="text-sm font-semibold mb-4 hidden md:block">Filters</h2>
          
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Log Type</Label>
              <Select value={filters.type} onValueChange={v => setFilters(f => ({ ...f, type: v }))}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="in">IN (Add)</SelectItem>
                  <SelectItem value="out_order">OUT (Order Dispatch)</SelectItem>
                  <SelectItem value="out_manual">OUT (Manual Remove)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Product</Label>
              <Select value={filters.product} onValueChange={v => setFilters(f => ({ ...f, product: v }))}>
                <SelectTrigger className="w-full text-sm">
                  <SelectValue placeholder="All Products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-1 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">From Date</Label>
                <Input 
                  type="date" 
                  value={filters.dateFrom} 
                  onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} 
                  className="text-sm w-full" 
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">To Date</Label>
                <Input 
                  type="date" 
                  value={filters.dateTo} 
                  onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} 
                  className="text-sm w-full" 
                />
              </div>
            </div>

            <Button 
              variant="secondary" 
              className="w-full text-xs" 
              onClick={() => setFilters({ dateFrom: "", dateTo: "", product: "all", type: "all" })}
            >
              Reset Filters
            </Button>
          </div>
        </div>

        {/* Logs List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-secondary/20">
          <div className="max-w-4xl mx-auto space-y-3">
            {filteredLogs.length === 0 ? (
              <div className="empty-state py-12">
                <p className="text-muted-foreground text-sm">No inventory logs found matching your filters.</p>
              </div>
            ) : (
              filteredLogs.map(log => {
                const isManualOut = log.type === "OUT" && log.reference && !log.reference.startsWith("ORD-");
                return (
                  <div key={log.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border border-border bg-card shadow-sm hover:shadow transition-shadow">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0", 
                        log.type === "IN" ? "bg-success/10" : "bg-destructive/10"
                      )}>
                        {log.type === "IN"
                          ? <TrendingUp className="w-5 h-5 text-success" />
                          : <TrendingDown className="w-5 h-5 text-destructive" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm md:text-base font-semibold text-foreground truncate">{log.productName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium shrink-0",
                            log.type === "IN" ? "bg-success/10 text-success" : 
                            getLogType(log) === "OUT(order)" ? "bg-primary/10 text-primary" : "bg-warning/10 text-warning"
                          )}>
                            {getLogType(log)}
                          </span>
                          <span className="text-[11px] md:text-xs text-muted-foreground truncate">
                            {formatDate(new Date(log.date), "dd MMM yyyy · HH:mm")}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center pl-13 sm:pl-0 mt-2 sm:mt-0 ml-[52px] sm:ml-0">
                      <span className={cn(
                        "text-sm md:text-base font-bold shrink-0", 
                        log.type === "IN" ? "text-success" : "text-destructive"
                      )}>
                        {log.type === "IN" ? "+" : "-"}{log.quantity.toLocaleString()} {products.find(p => p.id === log.productId)?.unit || 'kg'}
                      </span>
                      {log.reference && (
                        <span className={cn(
                          "text-[11px] md:text-xs mt-1",
                          isManualOut ? "text-muted-foreground italic truncate max-w-[200px]" : "font-mono text-muted-foreground"
                        )} title={log.reference}>
                          {isManualOut ? `Note: ${log.reference}` : `Ref: ${log.reference}`}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
