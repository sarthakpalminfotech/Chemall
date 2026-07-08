import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "@/lib/store";
import { Order, ContainerType } from "@/lib/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  MoreVertical,
  Plus,
  Minus,
  Filter,
  Search,
  AlertTriangle,
  QrCode,
  Download,
  Printer,
  Factory,
  X,
  SlidersHorizontal,
  Edit2,
  Flag,
  Truck,
  Eye,
  Mic,
  Camera,
} from "lucide-react";
import { formatDate } from "date-fns";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { useToast } from "@/hooks/use-toast";
import { cn, handleAudioCapture, handleCameraCapture } from "@/lib/utils";

// ─── Status + Priority Badges ──────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  if (status === "dispatched") {
    return (
      <span className="badge bg-slate-100 text-slate-700 border-slate-200 shadow-sm border px-2 py-0.5 rounded-md flex items-center gap-1.5 text-xs font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
        Dispatched
      </span>
    );
  }
  if (status === "in_production") {
    return (
      <span className="badge badge-in-production">
        <span className="w-1.5 h-1.5 rounded-full bg-success" />
        In Production
      </span>
    );
  }
  return (
    <span className="badge badge-pending">
      <span className="w-1.5 h-1.5 rounded-full bg-warning" />
      Pending
    </span>
  );
}

function PriorityBadge({ priority }: { priority: number }) {
  return (
    <span className="badge badge-priority">
      P{priority}
    </span>
  );
}

export default function Orders() {
  const navigate = useNavigate();
  const { currentUser, orders, products, markInProduction, assignPriority, markAsDispatched, isOwnerAdmin } = useStore();
  const { toast } = useToast();
  const qrRef = useRef<HTMLCanvasElement>(null);

  const canWrite = isOwnerAdmin() || currentUser?.moduleAccess.find(m => m.moduleName === "Orders")?.write === true;

  const [searchTerm, setSearchTerm] = useState("");
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    status: "all",
    dateFrom: "",
    dateTo: "",
    products: [] as string[],
    priorityOnly: false,
    recurringOnly: false,
    minQty: "",
    maxQty: "",
  });

  // Mark in Production
  const [inProductionModalOpen, setInProductionModalOpen] = useState(false);
  const [selectedOrderForProduction, setSelectedOrderForProduction] = useState<Order | null>(null);
  const [productionData, setProductionData] = useState({
    dispatchContainers: [] as { productId: string; containerTypeId: string; quantity: number }[],
    dispatchNote: "",
  });
  const [generatedBatch, setGeneratedBatch] = useState<string | null>(null);
  const [stockWarnings, setStockWarnings] = useState<string[]>([]);
  const [qrConfirmed, setQrConfirmed] = useState(false);

  // Priority Assignment
  const [priorityModalOpen, setPriorityModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedPriority, setSelectedPriority] = useState<number | undefined>();

  // Filter + sort
  const filteredOrders = useMemo(() => {
    let result = [...orders];

    if (searchTerm) {
      result = result.filter(
        (o) =>
          o.batchNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          o.supplierName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (filters.status !== "all") {
      result = result.filter((o) => o.status === filters.status);
    }
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      result = result.filter((o) => new Date(o.date) >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((o) => new Date(o.date) <= to);
    }
    if (filters.priorityOnly) {
      result = result.filter((o) => o.priority !== undefined && o.priority !== null);
    }
    if (filters.recurringOnly) {
      result = result.filter((o) => o.repeatOrder?.enabled);
    }
    if (filters.minQty || filters.maxQty) {
      const min = filters.minQty ? parseFloat(filters.minQty) : 0;
      const max = filters.maxQty ? parseFloat(filters.maxQty) : Infinity;
      result = result.filter((o) => {
        const totalQty = o.products.reduce((acc, p) => acc + p.quantity, 0);
        return totalQty >= min && totalQty <= max;
      });
    }

    // Sort logic:
    // 1. Status: dispatched goes to very bottom, then in_production, then pending
    // 2. Priority: Items with priority (1-10) come first
    // 3. Date: Latest created orders appear first
    result.sort((a, b) => {
      const getStatusRank = (s: string) => {
        if (s === "dispatched") return 3;
        if (s === "in_production") return 2;
        return 1; // pending
      };
      
      const aRank = getStatusRank(a.status);
      const bRank = getStatusRank(b.status);
      
      if (aRank !== bRank) return aRank - bRank;
      
      const aPriority = a.priority ?? 999;
      const bPriority = b.priority ?? 999;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return result;
  }, [orders, searchTerm, filters]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const openProductionModal = (order: Order) => {
    setSelectedOrderForProduction(order);
    
    // Auto-allocate default packaging for each product in the order using the allowed containers
    const defaultAllocations: { productId: string; containerTypeId: string; quantity: number }[] = [];
    
    order.products.forEach((p) => {
      // Find the allowed container types for this product
      const fullProd = products.find((prod) => prod.id === p.productId);
      const allowedCtIds = fullProd?.containerTypes || [];
      const allowedCts = products.filter((ct) => allowedCtIds.includes(ct.id) && ct.capacity && ct.capacity > 0);
      const targetCts = allowedCts;
      
      if (targetCts.length > 0) {
        const sortedCts = [...targetCts].sort((a, b) => b.capacity - a.capacity);
        let remainingQty = p.quantity;
        
        sortedCts.forEach((ct, index) => {
          const isLast = index === sortedCts.length - 1;
          const count = Math.floor(remainingQty / ct.capacity);
          
          if (count > 0) {
            defaultAllocations.push({
              productId: p.productId,
              containerTypeId: ct.id,
              quantity: count,
            });
            remainingQty -= count * ct.capacity;
          }
          
          if (isLast && remainingQty > 0) {
            const existing = defaultAllocations.find(da => da.productId === p.productId && da.containerTypeId === ct.id);
            if (existing) {
              existing.quantity += 1;
            } else {
              defaultAllocations.push({
                productId: p.productId,
                containerTypeId: ct.id,
                quantity: 1,
              });
            }
            remainingQty = 0;
          }
        });
      }
    });

    setProductionData({
      dispatchContainers: defaultAllocations,
      dispatchNote: "",
    });
    setGeneratedBatch(null);
    setStockWarnings([]);
    setQrConfirmed(false);
    setInProductionModalOpen(true);
  };

  const [searchParams] = useSearchParams();
  useEffect(() => {
    const markOrderId = searchParams.get("markInProduction");
    if (markOrderId && orders.length > 0) {
      const orderToMark = orders.find(o => o.id === markOrderId);
      if (orderToMark && orderToMark.status === "pending") {
        openProductionModal(orderToMark);
      }
    }
  }, [searchParams, orders]);

  const updateContainerCount = (productId: string, containerTypeId: string, count: number) => {
    setProductionData((prev) => {
      const existingIdx = prev.dispatchContainers.findIndex(
        (dc) => dc.productId === productId && dc.containerTypeId === containerTypeId
      );
      
      let newContainers = [...prev.dispatchContainers];
      if (existingIdx > -1) {
        if (count <= 0) {
          newContainers = newContainers.filter(
            (dc) => !(dc.productId === productId && dc.containerTypeId === containerTypeId)
          );
        } else {
          newContainers[existingIdx] = {
            ...newContainers[existingIdx],
            quantity: count,
          };
        }
      } else if (count > 0) {
        newContainers.push({
          productId,
          containerTypeId,
          quantity: count,
        });
      }
      
      return {
        ...prev,
        dispatchContainers: newContainers,
      };
    });
  };

  const toggleContainerSelection = (productId: string, containerTypeId: string, checked: boolean) => {
    setProductionData((prev) => {
      let newContainers = [...prev.dispatchContainers];
      if (!checked) {
        newContainers = newContainers.filter(
          (dc) => !(dc.productId === productId && dc.containerTypeId === containerTypeId)
        );
      } else {
        const ct = products.find(c => c.id === containerTypeId);
        if (!ct || !ct.capacity) return prev;
        const capacity = ct.capacity;
        
        const prod = selectedOrderForProduction?.products.find(p => p.productId === productId);
        const orderedQty = prod?.quantity || 0;
        
        const covered = newContainers
          .filter(dc => dc.productId === productId)
          .reduce((sum, dc) => {
            const c = products.find(t => t.id === dc.containerTypeId);
            return sum + (c?.capacity ? (dc.quantity * c.capacity) : 0);
          }, 0);
          
        const remaining = Math.max(0, orderedQty - covered);
        const defaultCount = remaining > 0 ? Math.ceil(remaining / capacity) : 1;
        
        newContainers.push({
          productId,
          containerTypeId,
          quantity: defaultCount,
        });
      }
      return {
        ...prev,
        dispatchContainers: newContainers,
      };
    });
  };

  const isAllocationValid = useMemo(() => {
    if (!selectedOrderForProduction) return false;
    for (const p of selectedOrderForProduction.products) {
      const allocations = productionData.dispatchContainers.filter(dc => dc.productId === p.productId);
      const totalCovered = allocations.reduce((sum, dc) => {
        const ct = products.find(c => c.id === dc.containerTypeId);
        return sum + (ct?.capacity ? (dc.quantity * ct.capacity) : 0);
      }, 0);
      
      if (totalCovered < p.quantity) {
        return false;
      }
    }
    return true;
  }, [selectedOrderForProduction, productionData.dispatchContainers, products]);

  const confirmProduction = async () => {
    if (!selectedOrderForProduction) return;
    if (!isAllocationValid) {
      toast({ title: "Validation Error", description: "All products must be fully allocated to containers.", variant: "destructive" });
      return;
    }
    try {
      const { batchNumber, stockWarnings: warnings } = await markInProduction(
        selectedOrderForProduction.id,
        productionData.dispatchContainers,
        productionData.dispatchNote,
        "" // QR data URL
      );
      setGeneratedBatch(batchNumber);
      setStockWarnings(warnings);
      setQrConfirmed(true);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const downloadQR = () => {
    if (!qrRef.current) return;
    const url = qrRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${generatedBatch || "qr"}.png`;
    a.click();
  };

  const printQR = () => {
    if (!qrRef.current) return;
    const url = qrRef.current.toDataURL("image/png");
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><body style="display:flex;justify-content:center;padding:20px"><img src="${url}" /><p style="text-align:center;font-family:monospace">${generatedBatch}</p></body></html>`);
    win.document.close();
    win.print();
  };



  const openPriorityModal = (orderId: string) => {
    setSelectedOrderId(orderId);
    const order = orders.find((o) => o.id === orderId);
    setSelectedPriority(order?.priority);
    setPriorityModalOpen(true);
  };

  const savePriority = async () => {
    if (selectedOrderId) {
      try {
        await assignPriority(selectedOrderId, selectedPriority);
        toast({ title: "Priority updated" });
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      }
    }
    setPriorityModalOpen(false);
  };

  const activeFiltersCount = [
    filters.status !== "all",
    !!filters.dateFrom,
    !!filters.dateTo,
    filters.priorityOnly,
    filters.recurringOnly,
    !!filters.minQty,
    !!filters.maxQty,
  ].filter(Boolean).length;

  return (
    <div className="w-full">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="px-4 md:px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Orders</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filteredOrders.length} order{filteredOrders.length !== 1 ? "s" : ""} found
            </p>
          </div>
          <div className="flex gap-2">
            {canWrite && (
              <Link to="/orders/new/manual">
                <Button className="gap-2 shadow-sm">
                  <Plus className="w-4 h-4" />
                  Add Order
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ─── Search + Filter ─────────────────────────────────────────────── */}
      <div className="px-4 md:px-6 mb-5 space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by Batch # or Customer..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            className={cn("gap-2 relative", activeFiltersCount > 0 && "border-primary text-primary")}
            onClick={() => setFilterDialogOpen(true)}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filter
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                {activeFiltersCount}
              </span>
            )}
          </Button>
        </div>

        {/* Active filter chips */}
        {activeFiltersCount > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {filters.status !== "all" && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium border border-primary/20">
                Status: {filters.status === "in_production" ? "In Production" : filters.status === "dispatched" ? "Dispatched" : "Pending"}
                <button onClick={() => setFilters({ ...filters, status: "all" })} className="ml-0.5 hover:opacity-60">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {(filters.dateFrom || filters.dateTo) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium border border-primary/20">
                Date: {filters.dateFrom || "Any"} - {filters.dateTo || "Any"}
                <button onClick={() => setFilters({ ...filters, dateFrom: "", dateTo: "" })} className="ml-0.5 hover:opacity-60">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.priorityOnly && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium border border-primary/20">
                Priority Only
                <button onClick={() => setFilters({ ...filters, priorityOnly: false })} className="ml-0.5 hover:opacity-60">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.recurringOnly && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium border border-primary/20">
                Recurring Only
                <button onClick={() => setFilters({ ...filters, recurringOnly: false })} className="ml-0.5 hover:opacity-60">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {(filters.minQty || filters.maxQty) && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium border border-primary/20">
                Qty: {filters.minQty || "0"} - {filters.maxQty || "Max"}
                <button onClick={() => setFilters({ ...filters, minQty: "", maxQty: "" })} className="ml-0.5 hover:opacity-60">
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ─── Orders List ─────────────────────────────────────────────────── */}
      <div className="px-4 md:px-6 pb-8">
        {filteredOrders.length === 0 ? (
          <div className="empty-state">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              <Search className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-foreground font-semibold">No orders found</p>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredOrders.map((order) => (
              <div 
                key={order.id} 
                className="list-row cursor-pointer transition-colors hover:bg-secondary/40 relative"
                onClick={(e) => {
                  if ((e.target as HTMLElement).closest('.prevent-click')) return;
                  if (!e.currentTarget.contains(e.target as Node)) return;
                  navigate(`/orders/${order.id}`);
                }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Badges row */}
                    <div className="flex items-center flex-wrap gap-2 mb-2.5">
                      <StatusBadge status={order.status} />
                      {order.priority && order.status !== "in_production" && (
                        <PriorityBadge priority={order.priority} />
                      )}
                      {order.repeatOrder?.enabled && (
                        <span className="badge bg-purple-500/10 text-purple-600 border border-purple-500/20">
                          Recurring
                        </span>
                      )}
                    </div>

                    {/* Batch + Customer */}
                    <div className="space-y-1">
                      {order.batchNumber && (
                        <p className="text-xs font-mono text-muted-foreground">
                          {order.batchNumber}
                        </p>
                      )}
                      <p className="text-sm font-semibold text-foreground">{order.supplierName}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.products.map((p) => p.productName).join(", ")}
                      </p>
                    </div>

                    {/* Meta row */}
                    <div className="flex flex-wrap items-center gap-3 mt-2.5 text-xs text-muted-foreground">
                      <span className="font-medium">Total: {order.products.reduce((s, p) => s + p.quantity, 0).toLocaleString()} kg</span>
                      <span className="text-foreground font-semibold">₹{order.totalAmount.toLocaleString()}</span>
                      <span>{formatDate(new Date(order.date), "dd MMM yyyy")}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {canWrite && order.status === "pending" && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          openProductionModal(order);
                        }}
                        className="p-1.5 text-success hover:bg-success/10 rounded-md transition-colors prevent-click"
                        title="Mark in Production"
                      >
                        <Factory className="w-4 h-4" />
                      </button>
                    )}
                    {canWrite && order.status === "in_production" && (
                      <button 
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await markAsDispatched(order.id);
                            toast({ title: "Order marked as dispatched" });
                          } catch (err: any) {
                            toast({ title: "Error", description: err.message, variant: "destructive" });
                          }
                        }}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors prevent-click"
                        title="Mark as Dispatched"
                      >
                        <Truck className="w-4 h-4" />
                      </button>
                    )}

                    {/* 3-dot menu */}
                    <div onClick={(e) => e.stopPropagation()} className="prevent-click ml-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 hover:bg-secondary rounded-md transition-colors">
                            <MoreVertical className="w-4 h-4 text-muted-foreground" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem className="cursor-pointer gap-2" asChild>
                            <Link to={`/orders/${order.id}`}>
                              <Eye className="w-4 h-4" /> View Details
                            </Link>
                          </DropdownMenuItem>
                          {canWrite && (
                            <DropdownMenuItem className="cursor-pointer gap-2">
                              <Edit2 className="w-4 h-4" /> Edit
                            </DropdownMenuItem>
                          )}
                          {isOwnerAdmin() && order.status === "pending" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="cursor-pointer gap-2"
                                onClick={() => openPriorityModal(order.id)}
                              >
                                <Flag className={cn("w-4 h-4", order.priority ? "text-primary" : "")} />
                                Assign Priority
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Filter Dialog ───────────────────────────────────────────────── */}
      <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Filter Orders</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="field-label">Status</Label>
              <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_production">In Production</SelectItem>
                  <SelectItem value="dispatched">Dispatched</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="field-label">Date Range</Label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">From</p>
                  <Input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">To</p>
                  <Input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
                </div>
              </div>
            </div>
            <div>
              <Label className="field-label">Quantity Range (kg)</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <Input type="number" placeholder="Min Qty" value={filters.minQty} onChange={(e) => setFilters({ ...filters, minQty: e.target.value })} />
                <Input type="number" placeholder="Max Qty" value={filters.maxQty} onChange={(e) => setFilters({ ...filters, maxQty: e.target.value })} />
              </div>
            </div>
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2">
                <Checkbox id="priority-filter" checked={filters.priorityOnly} onCheckedChange={(c) => setFilters({ ...filters, priorityOnly: !!c })} />
                <Label htmlFor="priority-filter" className="text-sm font-normal cursor-pointer">Show Priority Orders Only</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="recurring-filter" checked={filters.recurringOnly} onCheckedChange={(c) => setFilters({ ...filters, recurringOnly: !!c })} />
                <Label htmlFor="recurring-filter" className="text-sm font-normal cursor-pointer">Show Recurring Orders Only</Label>
              </div>
            </div>
            <div className="flex gap-2 pt-2 border-t border-border">
              <Button variant="outline" className="flex-1" onClick={() => { setFilters({ status: "all", dateFrom: "", dateTo: "", products: [], priorityOnly: false, recurringOnly: false, minQty: "", maxQty: "" }); setFilterDialogOpen(false); }}>
                Reset
              </Button>
              <Button className="flex-1" onClick={() => setFilterDialogOpen(false)}>
                Apply
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Mark in Production Modal ─────────────────────────────────────── */}
      <Dialog open={inProductionModalOpen} onOpenChange={(open) => { if (!open) setInProductionModalOpen(false); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Mark in Production</DialogTitle>
          </DialogHeader>
          {selectedOrderForProduction && (
            <div className="space-y-5">
              {/* Stock warnings */}
              {stockWarnings.length > 0 && (
                <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-warning">Stock Warning</p>
                    {stockWarnings.map((w, i) => (
                      <p key={i} className="text-xs text-warning/80 mt-1">{w}</p>
                    ))}
                  </div>
                </div>
              )}



              {/* Auto-generated batch preview */}
              {!qrConfirmed && !generatedBatch && (
                <div>
                  <Label className="field-label">Batch Number</Label>
                  <div className="p-3 bg-secondary rounded-lg text-sm font-mono text-muted-foreground">
                    Auto-generated on confirm
                  </div>
                </div>
              )}

              {/* Dispatch Containers per Product */}
              {!qrConfirmed && (
                <div className="space-y-4">
                  <Label className="text-xs uppercase font-bold tracking-wider text-muted-foreground">
                    Dispatch Containers Allocation
                  </Label>
                  <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                    {selectedOrderForProduction.products.map((p) => {
                      const fullProd = products.find((prod) => prod.id === p.productId);
                      const allowedCtIds = fullProd?.containerTypes || [];
                      const productCts = products.filter((ct) => allowedCtIds.includes(ct.id) && ct.capacity && ct.capacity > 0);
                      const targetCts = productCts;
                      
                      const allocations = productionData.dispatchContainers.filter(dc => dc.productId === p.productId);
                      const totalCovered = allocations.reduce((sum, dc) => {
                        const ct = products.find(c => c.id === dc.containerTypeId);
                        return sum + (dc.quantity * (ct?.capacity || 0));
                      }, 0);
                      const isCovered = totalCovered >= p.quantity;

                      return (
                        <div key={p.productId} className="p-3.5 border border-border rounded-xl bg-card/50 space-y-3">
                          <div className="flex items-center justify-between border-b border-border/50 pb-2">
                            <div>
                              <h4 className="font-semibold text-sm text-foreground">{p.productName}</h4>
                              <p className="text-xs text-muted-foreground">Order Target: <span className="font-bold text-foreground">{p.quantity} kg</span></p>
                            </div>
                            <div className="text-right">
                              <span className={cn(
                                "text-xs font-semibold px-2 py-0.5 rounded-full",
                                isCovered 
                                  ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                                  : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                              )}>
                                Allocated: {totalCovered} / {p.quantity} kg
                              </span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            {targetCts.length === 0 ? (
                              <p className="text-xs text-destructive bg-destructive/10 p-2 rounded-md text-center">No containers configured in Product Master.</p>
                            ) : targetCts.map((ct) => {
                              const allocation = allocations.find(a => a.containerTypeId === ct.id);
                              const isChecked = !!allocation;
                              const count = allocation?.quantity || 0;

                              return (
                                <div key={ct.id} className="flex flex-col gap-2 p-2 rounded-lg hover:bg-secondary/40 transition-colors">
                                  <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                                      <Checkbox
                                        checked={isChecked}
                                        onCheckedChange={(checked) => toggleContainerSelection(p.productId, ct.id, !!checked)}
                                      />
                                      <div className="text-xs">
                                        <p className="font-medium text-foreground">{ct.name}</p>
                                        <p className="text-muted-foreground text-[10px]">Capacity: {ct.capacity} kg</p>
                                      </div>
                                    </label>

                                    {isChecked && (
                                      <div className="flex items-center gap-2">
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          className="w-7 h-7"
                                          onClick={() => updateContainerCount(p.productId, ct.id, count - 1)}
                                        >
                                          <Minus className="w-3 h-3" />
                                        </Button>
                                        <Input
                                          type="number"
                                          min="1"
                                          value={count}
                                          onChange={(e) => updateContainerCount(p.productId, ct.id, Math.max(1, parseInt(e.target.value) || 1))}
                                          className="w-14 h-7 text-xs text-center px-1"
                                        />
                                        <Button
                                          variant="outline"
                                          size="icon"
                                          className="w-7 h-7"
                                          onClick={() => updateContainerCount(p.productId, ct.id, count + 1)}
                                        >
                                          <Plus className="w-3 h-3" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {isChecked && (
                                    <div className="text-right text-[10px] text-muted-foreground font-mono">
                                      Contribution: {count * ct.capacity} kg
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          
                          {!isCovered && (
                            <p className="text-[10px] text-amber-500 flex items-center gap-1 mt-1 font-medium">
                              <AlertTriangle className="w-3 h-3" /> Allocation is under target. Need {p.quantity - totalCovered} kg more.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Order Summary (read-only) */}
              {!qrConfirmed && (
                <div className="p-3 bg-secondary/50 rounded-lg space-y-1.5 text-sm">
                  <p className="font-semibold text-foreground text-xs uppercase tracking-wide text-muted-foreground mb-2">Order Summary</p>
                  <p><span className="text-muted-foreground">Customer:</span> <span className="font-medium">{selectedOrderForProduction.supplierName}</span></p>
                  {selectedOrderForProduction.products.map((p) => (
                    <p key={p.productId}><span className="text-muted-foreground">{p.productName}:</span> <span className="font-medium">{p.quantity} kg</span></p>
                  ))}
                  {selectedOrderForProduction.preferredContainers?.length > 0 && (
                    <p>
                      <span className="text-muted-foreground">Preferred containers:</span>{" "}
                      <span className="font-medium">
                        {selectedOrderForProduction.preferredContainers
                          .map((id) => products.find((c) => c.id === id)?.name || id)
                          .join(", ")}
                      </span>
                    </p>
                  )}
                </div>
              )}

              {/* Dispatch Note */}
              {!qrConfirmed && (
                <div>
                  <Label className="field-label">Dispatch Note (optional)</Label>
                  <div className="relative">
                    <textarea
                      value={productionData.dispatchNote}
                      onChange={(e) => setProductionData({ ...productionData, dispatchNote: e.target.value })}
                      placeholder="Add any dispatch notes..."
                      rows={3}
                      className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring pb-10"
                    />
                    <div className="absolute bottom-2 left-2 flex items-center gap-2">
                      <Button type="button" variant="secondary" size="icon" className="w-8 h-8 rounded-full" onClick={() => {
                        handleAudioCapture((file) => {
                          setProductionData(prev => ({ ...prev, dispatchNote: prev.dispatchNote ? prev.dispatchNote + `\n[Audio attached: ${file.name}]` : `[Audio attached: ${file.name}]` }));
                          toast({ title: "Audio attached", description: "Audio reference added to dispatch note." });
                        });
                      }}>
                        <Mic className="w-4 h-4" />
                      </Button>
                      <Button type="button" variant="secondary" size="icon" className="w-8 h-8 rounded-full" onClick={() => {
                        handleCameraCapture((file) => {
                          setProductionData(prev => ({ ...prev, dispatchNote: prev.dispatchNote ? prev.dispatchNote + `\n[Image attached: ${file.name}]` : `[Image attached: ${file.name}]` }));
                          toast({ title: "Image attached", description: "Image reference added to dispatch note." });
                        });
                      }}>
                        <Camera className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* QR Code (shown after batch generation) */}
              {qrConfirmed && generatedBatch && (
                <div className="flex flex-col items-center text-center space-y-6 py-4">
                  <div>
                    <h3 className="text-xl font-bold text-success mb-1 flex items-center justify-center gap-2">
                      <Factory className="w-5 h-5" /> Order in Production
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Order Number: <span className="font-mono font-bold text-foreground">{generatedBatch}</span>
                    </p>
                  </div>

                  <div className="flex flex-col items-center gap-4 p-6 bg-white border border-border rounded-xl shadow-sm w-full max-w-[280px] mx-auto">
                    {/* Visible SVG QR */}
                    <QRCodeSVG
                      value={generatedBatch}
                      size={180}
                      level="H"
                      includeMargin
                    />
                    {/* Hidden canvas for download */}
                    <QRCodeCanvas
                      ref={qrRef}
                      value={generatedBatch}
                      size={400}
                      level="H"
                      includeMargin
                      style={{ display: "none" }}
                    />
                    
                    <div className="flex gap-3 w-full mt-2">
                      <Button variant="outline" size="sm" className="flex-1 gap-2 bg-secondary/50 hover:bg-secondary" onClick={downloadQR}>
                        <Download className="w-4 h-4" /> Download
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 gap-2 bg-secondary/50 hover:bg-secondary" onClick={printQR}>
                        <Printer className="w-4 h-4" /> Print
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-border">
                <Button variant="outline" className="flex-1" onClick={() => setInProductionModalOpen(false)}>
                  {qrConfirmed ? "Close" : "Cancel"}
                </Button>
                {!qrConfirmed && (
                  <Button className="flex-1 gap-2" onClick={confirmProduction} disabled={!isAllocationValid}>
                    <Factory className="w-4 h-4" />
                    Confirm & Generate QR
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Priority Modal ───────────────────────────────────────────────── */}
      <Dialog open={priorityModalOpen} onOpenChange={setPriorityModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign Priority</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select 1–10 (1 = highest). In-production orders are excluded from priority sorting.
            </p>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
                const isUsed = orders.some(
                  (o) => o.status === "pending" && o.priority === n && o.id !== selectedOrderId
                );
                return (
                  <button
                    key={n}
                    disabled={isUsed}
                    onClick={() => setSelectedPriority(n)}
                    className={cn(
                      "h-10 rounded-lg font-semibold text-sm transition-all",
                      isUsed
                        ? "bg-secondary/50 text-muted-foreground cursor-not-allowed opacity-50 border border-transparent"
                        : selectedPriority === n
                        ? "bg-primary text-primary-foreground shadow-md scale-105"
                        : "bg-secondary hover:bg-secondary/70 text-foreground"
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            {selectedPriority && (
              <div className="p-2.5 bg-primary/10 rounded-lg text-sm text-center font-medium text-primary">
                Priority P{selectedPriority} selected
              </div>
            )}
            <button
              onClick={() => setSelectedPriority(undefined)}
              className="w-full py-2 text-sm text-destructive hover:bg-destructive/5 rounded-lg transition-colors font-medium"
            >
              Remove Priority
            </button>
            <div className="flex gap-2 pt-2 border-t border-border">
              <Button variant="outline" className="flex-1" onClick={() => setPriorityModalOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={savePriority}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
