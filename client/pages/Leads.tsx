import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Building2, User, Phone, MapPin, Filter, MoreVertical, Edit2 } from "lucide-react";
import { formatDate } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { LeadStatus, Lead } from "@/lib/types";

export default function Leads() {
  const { leads, products, updateLead, addSupplier } = useStore();
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();
  
  // Filters
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterIntensity, setFilterIntensity] = useState<string>("all");
  const [filterProduct, setFilterProduct] = useState<string>("all");
  const [filterStatuses, setFilterStatuses] = useState<LeadStatus[]>([]);

  // Status Change Modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [newStatus, setNewStatus] = useState<LeadStatus>("new");
  const [statusReason, setStatusReason] = useState("");
  const [scheduledAlertDate, setScheduledAlertDate] = useState("");

  const allSources = Array.from(new Set(leads.map(l => l.source)));
  const allProductIds = Array.from(new Set(leads.flatMap(l => l.products)));
  const availableProducts = products.filter(p => allProductIds.includes(p.id));

  const allStatuses: LeadStatus[] = ["new", "in discussion", "paused/hold", "won", "lost", "disqualified"];

  const filteredLeads = leads.filter(
    (l) => {
      const matchesSearch = l.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            (l.contactPersonName && l.contactPersonName.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesSource = filterSource === "all" || l.source === filterSource;
      const matchesIntensity = filterIntensity === "all" || l.intensity === filterIntensity;
      const matchesProduct = filterProduct === "all" || l.products.includes(filterProduct);
      const matchesStatus = filterStatuses.length === 0 || filterStatuses.includes(l.status);
      
      return matchesSearch && matchesSource && matchesIntensity && matchesProduct && matchesStatus;
    }
  );

  const activeFiltersCount = (filterSource !== "all" ? 1 : 0) + 
                             (filterIntensity !== "all" ? 1 : 0) + 
                             (filterProduct !== "all" ? 1 : 0) + 
                             (filterStatuses.length > 0 ? 1 : 0);

  const clearFilters = () => {
    setFilterSource("all");
    setFilterIntensity("all");
    setFilterProduct("all");
    setFilterStatuses([]);
  };

  const toggleStatusFilter = (status: LeadStatus) => {
    setFilterStatuses(prev => 
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  const openStatusModal = (e: React.MouseEvent, lead: Lead) => {
    e.stopPropagation();
    setSelectedLead(lead);
    setNewStatus(lead.status);
    setStatusReason(lead.statusReason || "");
    setScheduledAlertDate(lead.scheduledAlert ? new Date(lead.scheduledAlert.getTime() - lead.scheduledAlert.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
    setStatusModalOpen(true);
  };

  const handleStatusChange = async (addToOrders: boolean = false) => {
    if (!selectedLead) return;
    
    // validate reason
    if (newStatus === "paused/hold" && !statusReason.trim()) {
      return; // UI should disable button anyway
    }

    await updateLead(selectedLead.id, {
      status: newStatus,
      statusReason: statusReason.trim() || undefined,
      scheduledAlert: (newStatus === "paused/hold" && scheduledAlertDate) ? new Date(scheduledAlertDate) : undefined
    });

    setStatusModalOpen(false);
    
    if (addToOrders && newStatus === "won") {
      try {
        const supp = await addSupplier({
          name: selectedLead.companyName,
          address: selectedLead.address || "",
          contactNumber: selectedLead.contactNumber,
          leadSource: selectedLead.source,
          type: "customer"
        });
        navigate("/orders/new/manual", { state: { customerId: supp.id, productIds: selectedLead.products } });
      } catch (err: any) {
        console.error("Error creating supplier from lead", err);
        navigate("/orders/new/manual", { state: { productIds: selectedLead.products } });
      }
    }
  };

  const statusColors: Record<LeadStatus, string> = {
    "new": "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    "in discussion": "bg-blue-500/10 text-blue-600 border-blue-500/20",
    "paused/hold": "bg-amber-500/10 text-amber-600 border-amber-500/20",
    "won": "bg-green-500/10 text-green-600 border-green-500/20",
    "lost": "bg-red-500/10 text-red-600 border-red-500/20",
    "disqualified": "bg-zinc-500/10 text-zinc-600 border-zinc-500/20",
  };

  return (
    <div className="w-full">
      <div className="px-4 md:px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Leads</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {filteredLeads.length} lead{filteredLeads.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Link to="/leads/new">
            <Button className="gap-2 shadow-sm">
              <Plus className="w-4 h-4" />
              Add Lead
            </Button>
          </Link>
        </div>
      </div>

      <div className="px-4 md:px-6 mb-5 flex gap-2 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search company or contact..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-card border-border h-10 shadow-sm"
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
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-10 px-2 text-muted-foreground">
            Clear
          </Button>
        )}
      </div>

      <div className="px-4 md:px-6 pb-8">
        {filteredLeads.length === 0 ? (
          <div className="empty-state">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              <Building2 className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <p className="font-semibold text-foreground">No leads found</p>
            <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters or search</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredLeads.map((lead) => {
              const intensityColors = {
                cold: "text-blue-500",
                moderate: "text-amber-500",
                hot: "text-red-500",
              };
              
              const productNames = lead.products.map(id => products.find(p => p.id === id)?.name).filter(Boolean);

              return (
                <div 
                  key={lead.id} 
                  className="card-elevated p-4 transition-all h-full flex flex-col cursor-pointer hover:border-primary/40"
                  onClick={() => navigate(`/leads/${lead.id}`)}
                >
                  <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-2 mb-2">
                    <h3 className="font-bold text-foreground text-sm line-clamp-1 flex-1 min-w-[120px]">{lead.companyName}</h3>
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end ml-auto">
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md border font-semibold uppercase tracking-wider whitespace-nowrap", statusColors[lead.status] || statusColors["new"])}>
                        {lead.status === "active" ? "new" : lead.status}
                      </span>
                      <span className={cn("text-[10px] font-bold uppercase tracking-wider whitespace-nowrap", intensityColors[lead.intensity])}>
                        • {lead.intensity}
                      </span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 -mr-1" onClick={(e) => openStatusModal(e, lead)}>
                        <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs mt-3">
                    {lead.contactPersonName && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{lead.contactPersonName}</span>
                      </div>
                    )}
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <Phone className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        <span className="truncate">{lead.contactNumber} {lead.contactPersonName ? "(Co)" : ""}</span>
                        {lead.contactPersonNumber && <span className="truncate">{lead.contactPersonNumber} (P)</span>}
                      </div>
                    </div>
                    {lead.address && (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span className="line-clamp-1 truncate">{lead.address}</span>
                      </div>
                    )}
                  </div>
                  
                  {(productNames.length > 0 || lead.quantity) && (
                    <div className="mt-3 pt-2 border-t border-border/50 text-xs text-muted-foreground">
                      {productNames.length > 0 && (
                        <p className="line-clamp-1">
                          <span className="font-semibold text-foreground">Prod:</span> {productNames.join(", ")}
                        </p>
                      )}
                      {lead.quantity && (
                        <p className="mt-0.5">
                          <span className="font-semibold text-foreground">Qty:</span> {lead.quantity} kg
                        </p>
                      )}
                    </div>
                  )}

                  <div className="mt-auto pt-3 flex items-center justify-between text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                    <span className="truncate mr-2">Src: {lead.source}</span>
                    <span className="shrink-0">{formatDate(new Date(lead.createdAt), "dd MMM yyy")}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Filter Modal */}
      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Filter Leads</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="field-label text-xs mb-2 block">Status</Label>
              <div className="grid grid-cols-2 gap-2">
                {allStatuses.map((status) => (
                  <label key={status} className="flex items-center gap-2 p-2 rounded border border-border cursor-pointer hover:bg-secondary/50">
                    <Checkbox
                      checked={filterStatuses.includes(status)}
                      onCheckedChange={() => toggleStatusFilter(status)}
                    />
                    <span className="text-xs font-medium capitalize">{status}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="field-label text-xs">Intensity</Label>
              <Select value={filterIntensity} onValueChange={setFilterIntensity}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All Intensities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Intensities</SelectItem>
                  <SelectItem value="cold">Cold</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="hot">Hot</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="field-label text-xs">Source</Label>
              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger className="h-9 text-sm capitalize">
                  <SelectValue placeholder="All Sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  {allSources.map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="field-label text-xs">Product</Label>
              <Select value={filterProduct} onValueChange={setFilterProduct}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="All Products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  {availableProducts.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
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

      {/* Status Change Modal */}
      <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Lead Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="field-label text-xs">Status</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as LeadStatus)}>
                <SelectTrigger className="h-9 text-sm capitalize">
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  {allStatuses.map(s => (
                    <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {(newStatus === "paused/hold" || newStatus === "lost" || newStatus === "disqualified") && (
              <div className="space-y-4">
                <div>
                  <Label className="field-label text-xs">
                    Reason {newStatus === "paused/hold" && <span className="text-destructive">*</span>}
                  </Label>
                  <textarea
                    value={statusReason}
                    onChange={(e) => setStatusReason(e.target.value)}
                    placeholder="Enter reason..."
                    rows={3}
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                {newStatus === "paused/hold" && (
                  <div>
                    <Label className="field-label text-xs">Schedule Alert (Optional)</Label>
                    <Input 
                      type="datetime-local" 
                      value={scheduledAlertDate}
                      onChange={(e) => setScheduledAlertDate(e.target.value)}
                    />
                  </div>
                )}
              </div>
            )}
            
            {newStatus === "won" ? (
              <div className="flex gap-2 pt-4 border-t border-border">
                <Button variant="outline" className="flex-1" onClick={() => handleStatusChange(false)}>Save & Skip</Button>
                <Button className="flex-1" onClick={() => handleStatusChange(true)}>Add to Orders</Button>
              </div>
            ) : (
              <div className="flex gap-2 pt-4 border-t border-border">
                <Button variant="outline" className="flex-1" onClick={() => setStatusModalOpen(false)}>Cancel</Button>
                <Button 
                  className="flex-1" 
                  onClick={() => handleStatusChange(false)}
                  disabled={newStatus === "paused/hold" && !statusReason.trim()}
                >
                  Save Status
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
