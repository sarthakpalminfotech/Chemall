import { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, Filter, History, User, Clock, CheckCircle2, AlertTriangle, AlertCircle, Info, LayoutTemplate } from "lucide-react";
import { formatDate } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export default function Logs() {
  const { systemLogs, employees } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  
  // Filters
  const [filterOpen, setFilterOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedModule, setSelectedModule] = useState<string>("all");

  const filteredLogs = useMemo(() => {
    let result = [...systemLogs];

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (l) => l.action.toLowerCase().includes(q) || l.employeeName.toLowerCase().includes(q) || l.module.toLowerCase().includes(q)
      );
    }

    if (selectedEmployee !== "all") {
      result = result.filter((l) => l.employeeId === selectedEmployee);
    }
    
    if (selectedModule !== "all") {
      result = result.filter((l) => l.module === selectedModule);
    }

    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      result = result.filter((l) => new Date(l.createdAt) >= from);
    }

    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((l) => new Date(l.createdAt) <= to);
    }

    return result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [systemLogs, searchTerm, dateFrom, dateTo, selectedEmployee, selectedModule]);

  const activeFiltersCount = [
    dateFrom,
    dateTo,
    selectedEmployee !== "all",
    selectedModule !== "all"
  ].filter(Boolean).length;

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setSelectedEmployee("all");
    setSelectedModule("all");
  };

  const getModuleIcon = (mod: string) => {
    switch (mod.toLowerCase()) {
      case "orders": return <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />;
      case "leads": return <AlertCircle className="w-3.5 h-3.5 text-amber-500" />;
      case "inventory": return <LayoutTemplate className="w-3.5 h-3.5 text-emerald-500" />;
      case "employees": return <User className="w-3.5 h-3.5 text-purple-500" />;
      case "products": return <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />;
      default: return <Info className="w-3.5 h-3.5 text-slate-500" />;
    }
  };

  const allModules = Array.from(new Set(systemLogs.map(l => l.module)));

  return (
    <div className="w-full">
      <div className="px-4 md:px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">System Logs</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filteredLogs.length} activity record{filteredLogs.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 mb-5 flex gap-2 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search action, employee, module..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10 shadow-sm"
          />
        </div>
        <Button 
          variant={activeFiltersCount > 0 ? "default" : "outline"}
          size="icon"
          className="h-10 w-10 shrink-0 relative"
          onClick={() => setFilterOpen(true)}
        >
          <Filter className="w-4 h-4" />
          {activeFiltersCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white">
              {activeFiltersCount}
            </span>
          )}
        </Button>
        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-10 px-2 text-muted-foreground hidden sm:flex">
            Clear
          </Button>
        )}
      </div>

      <div className="px-4 md:px-6 pb-8">
        {filteredLogs.length === 0 ? (
          <div className="empty-state">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              <History className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <p className="font-semibold text-foreground">No logs found</p>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or perform some actions</p>
          </div>
        ) : (
          <div className="card-elevated overflow-hidden divide-y divide-border/50">
            {filteredLogs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-secondary/40 transition-colors flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold bg-secondary px-2 py-0.5 rounded-md">
                      {getModuleIcon(log.module)}
                      {log.module}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3" />
                      {formatDate(log.createdAt, "dd MMM yyyy, hh:mm a")}
                    </span>
                  </div>
                  <p className="text-sm text-foreground font-medium">{log.action}</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground sm:text-right shrink-0 bg-background/50 border border-border px-3 py-1.5 rounded-lg w-fit sm:w-auto">
                  <User className="w-4 h-4 shrink-0 text-primary" />
                  <span className="font-medium truncate max-w-[120px]" title={log.employeeName}>{log.employeeName}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter Modal */}
      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Filter Logs</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="field-label text-xs">Date Range</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1 uppercase font-semibold">From</p>
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1 uppercase font-semibold">To</p>
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                </div>
              </div>
            </div>

            <div>
              <Label className="field-label text-xs">Employee</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="field-label text-xs">Module</Label>
              <Select value={selectedModule} onValueChange={setSelectedModule}>
                <SelectTrigger className="h-9 capitalize">
                  <SelectValue placeholder="All Modules" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modules</SelectItem>
                  {allModules.map(mod => (
                    <SelectItem key={mod} value={mod} className="capitalize">{mod}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-4 border-t border-border">
              <Button variant="outline" className="flex-1 h-9 text-sm" onClick={() => { clearFilters(); setFilterOpen(false); }}>Reset</Button>
              <Button className="flex-1 h-9 text-sm" onClick={() => setFilterOpen(false)}>Apply</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
