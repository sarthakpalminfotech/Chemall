import { useState } from "react";
import { useStore } from "@/lib/store";
import { ProductType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, History, X, Package, AlertTriangle, TrendingDown, TrendingUp, Minus, Mic, Camera, Search } from "lucide-react";
import { formatDate } from "date-fns";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { cn, handleAudioCapture, handleCameraCapture } from "@/lib/utils";

interface AddItem {
  productId: string;
  quantity: number;
}



export default function Inventory() {
  const { products, inventory, inventoryLogs, addInventory, removeInventory } = useStore();
  const { toast } = useToast();

  const [productFilter, setProductFilter] = useState<ProductType>("finished_good");
  const [searchTerm, setSearchTerm] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addItems, setAddItems] = useState<AddItem[]>([{ productId: "", quantity: 0 }]);
  const [addType, setAddType] = useState<ProductType>("finished_good");

  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [removeProductId, setRemoveProductId] = useState("");
  const [removeQuantity, setRemoveQuantity] = useState(0);
  const [removeNotes, setRemoveNotes] = useState("");

  const filteredInventory = inventory.filter(i => 
    i.productType === productFilter &&
    (!searchTerm || i.productName.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const availableProducts = products.filter(p => p.type === addType);
  const usedIds = addItems.map(i => i.productId).filter(Boolean);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const addRow = () => setAddItems(p => [...p, { productId: "", quantity: 0 }]);
  const removeRow = (idx: number) => setAddItems(p => p.filter((_, i) => i !== idx));

  const updateRow = (idx: number, field: string, value: any) => {
    setAddItems(p => {
      const updated = [...p];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  const handleAddToInventory = async () => {
    const valid = addItems.filter(i => i.productId && i.quantity > 0);
    if (valid.length === 0) return;
    // Check for duplicate products
    const ids = valid.map(i => i.productId);
    if (new Set(ids).size !== ids.length) {
      toast({ title: "Duplicate products", description: "Each product can only appear once per batch.", variant: "destructive" });
      return;
    }
    try {
      await addInventory(valid.map(i => ({ productId: i.productId, quantity: i.quantity })));
      toast({ title: "Inventory updated", description: `Added ${valid.length} product(s) to stock.` });
      setAddDialogOpen(false);
      setAddItems([{ productId: "", quantity: 0 }]);
    } catch (err: any) {
      toast({ title: "Error updating inventory", description: err.message, variant: "destructive" });
    }
  };

  const handleAddClick = (productId: string, productType: ProductType) => {
    setAddType(productType);
    setAddItems([{ productId, quantity: 0 }]);
    setAddDialogOpen(true);
  };

  const handleRemoveClick = (productId: string) => {
    setRemoveProductId(productId);
    setRemoveQuantity(0);
    setRemoveNotes("");
    setRemoveDialogOpen(true);
  };

  const handleRemoveInventory = async () => {
    if (!removeProductId || removeQuantity <= 0 || !removeNotes.trim()) {
      toast({ title: "Validation Error", description: "All fields including notes are mandatory.", variant: "destructive" });
      return;
    }
    try {
      await removeInventory(removeProductId, removeQuantity, removeNotes);
      toast({ title: "Inventory updated", description: "Successfully removed from stock." });
      setRemoveDialogOpen(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const isAddValid = addItems.some(i => i.productId && i.quantity > 0);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="px-4 md:px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Inventory</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage stock levels and history</p>
          </div>
          <div className="flex gap-2">
            {/* History */}
            <Link to="/inventory/history">
              <Button variant="outline" className="gap-2">
                <History className="w-4 h-4" /> History
              </Button>
            </Link>

            {/* Add Inventory */}
            <Dialog open={addDialogOpen} onOpenChange={open => { setAddDialogOpen(open); if (!open) setAddItems([{ productId: "", quantity: 0 }]); }}>
              <DialogTrigger asChild>
                <Button className="gap-2 shadow-sm"><Plus className="w-4 h-4" /> Add Inventory</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Add Inventory</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  {/* Type Toggle */}
                  <div>
                    <Label className="field-label">Product Type</Label>
                    <Tabs value={addType} onValueChange={v => { setAddType(v as ProductType); setAddItems([{ productId: "", quantity: 0 }]); }}>
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="finished_good">Finished Goods</TabsTrigger>
                        <TabsTrigger value="raw_material">Raw Material</TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  {/* Product rows */}
                  <div className="space-y-3">
                    {addItems.map((item, idx) => (
                      <div key={idx} className="p-3 bg-secondary/50 rounded-xl border border-border/50 space-y-2">
                        <div className="flex gap-2">
                          <Select value={item.productId} onValueChange={v => updateRow(idx, "productId", v)}>
                            <SelectTrigger className="flex-1 text-sm"><SelectValue placeholder="Select product" /></SelectTrigger>
                            <SelectContent>
                              {availableProducts.filter(p => !usedIds.includes(p.id) || p.id === item.productId).map(p => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}{p.capacity ? ` (${p.capacity} kg)` : ""}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {addItems.length > 1 && (
                            <button type="button" onClick={() => removeRow(idx)} className="p-2 text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                        <Input
                          type="number"
                          min="1"
                          placeholder={`Quantity (${products.find(p => p.id === item.productId)?.unit || 'kg'})`}
                          value={item.quantity || ""}
                          onChange={e => updateRow(idx, "quantity", parseInt(e.target.value) || 0)}
                          className="text-sm"
                        />
                      </div>
                    ))}
                  </div>

                  <Button variant="outline" className="w-full gap-2" onClick={addRow}>
                    <Plus className="w-4 h-4" /> Add More
                  </Button>

                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button variant="outline" className="flex-1" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                    <Button className="flex-1" onClick={handleAddToInventory} disabled={!isAddValid}>
                      Add to Inventory
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            {/* Remove Inventory */}
            <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Remove Inventory</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label className="field-label">Product</Label>
                    <Select value={removeProductId} onValueChange={setRemoveProductId}>
                      <SelectTrigger className="w-full text-sm">
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="field-label">Quantity ({products.find(p => p.id === removeProductId)?.unit || 'kg'})</Label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="Enter quantity"
                      value={removeQuantity || ""}
                      onChange={(e) => setRemoveQuantity(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label className="field-label">Notes <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Textarea 
                        placeholder="Reason for removing inventory..."
                        value={removeNotes}
                        onChange={(e) => setRemoveNotes(e.target.value)}
                        className="min-h-[100px] resize-none pb-12"
                      />
                      <div className="absolute bottom-2 left-2 flex items-center gap-2">
                        <Button type="button" variant="secondary" size="icon" className="w-8 h-8 rounded-full" onClick={() => {
                          handleAudioCapture((file) => {
                            setRemoveNotes(prev => prev ? prev + `\n[Audio attached: ${file.name}]` : `[Audio attached: ${file.name}]`);
                            toast({ title: "Audio attached", description: "Audio reference added to notes." });
                          });
                        }}>
                          <Mic className="w-4 h-4" />
                        </Button>
                        <Button type="button" variant="secondary" size="icon" className="w-8 h-8 rounded-full" onClick={() => {
                          handleCameraCapture((file) => {
                            setRemoveNotes(prev => prev ? prev + `\n[Image attached: ${file.name}]` : `[Image attached: ${file.name}]`);
                            toast({ title: "Image attached", description: "Image reference added to notes." });
                          });
                        }}>
                          <Camera className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button variant="outline" className="flex-1" onClick={() => setRemoveDialogOpen(false)}>Cancel</Button>
                    <Button className="flex-1" onClick={handleRemoveInventory} disabled={!removeProductId || removeQuantity <= 0 || !removeNotes.trim()}>
                      Confirm Removal
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Type Toggle & Search */}
      <div className="px-4 md:px-6 mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Tabs value={productFilter} onValueChange={v => setProductFilter(v as ProductType)}>
          <TabsList className="grid w-full grid-cols-2 w-[320px]">
            <TabsTrigger value="finished_good">Finished Goods</TabsTrigger>
            <TabsTrigger value="raw_material">Raw Material</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search products..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-card border-border h-10 shadow-sm"
          />
        </div>
      </div>

      {/* Inventory Grid */}
      <div className="px-4 md:px-6 pb-8">
        {filteredInventory.length === 0 ? (
          <div className="empty-state">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-4">
              <Package className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <p className="font-semibold text-foreground">No inventory items</p>
            <p className="text-sm text-muted-foreground mt-1">Use "Add Inventory" to stock up</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredInventory.map(item => {
              const product = products.find(p => p.id === item.productId);
              const threshold = product?.alertThreshold ?? 100;
              const isLow = item.quantity < threshold;
              const isNegative = item.quantity < 0;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "card-elevated p-5 transition-all",
                    isNegative ? "border-destructive/40 bg-destructive/5" : isLow ? "border-warning/40 bg-warning/5" : ""
                  )}
                >
                  {/* Low stock badge */}
                  {isLow && (
                    <div className={cn("flex items-center gap-1.5 mb-3 text-xs font-semibold", isNegative ? "text-destructive" : "text-warning")}>
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {isNegative ? "Stock Negative" : "Low Stock"}
                    </div>
                  )}

                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Product</p>
                      <h3 className="font-semibold text-foreground text-sm leading-snug mb-4">{item.productName}</h3>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <Button variant="outline" size="icon" className="w-7 h-7 bg-card hover:bg-destructive/10 hover:text-destructive border-border" onClick={() => handleRemoveClick(item.productId)}>
                        <Minus className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="outline" size="icon" className="w-7 h-7 bg-card hover:bg-primary/10 hover:text-primary border-border" onClick={() => handleAddClick(item.productId, item.productType)}>
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className={cn("rounded-xl p-4 text-center", isNegative ? "bg-destructive/10" : isLow ? "bg-warning/10" : "bg-secondary")}>
                    <p className={cn("text-3xl font-bold tracking-tight", isNegative ? "text-destructive" : isLow ? "text-warning" : "text-foreground")}>
                      {item.quantity.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">{product?.unit || 'kg'} in stock</p>
                  </div>

                  <p className="text-[11px] text-muted-foreground mt-3">
                    Updated {formatDate(new Date(item.lastUpdated), "dd MMM yyyy · HH:mm")}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
