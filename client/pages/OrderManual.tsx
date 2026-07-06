import { useState, useMemo } from "react";
import { Link, useNavigate, useLocation, Navigate } from "react-router-dom";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStore } from "@/lib/store";
import { ArrowLeft, Plus, X, Info, AlertCircle, Mic, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn, handleAudioCapture, handleCameraCapture } from "@/lib/utils";

interface OrderProduct {
  productId: string;
  productName: string;
  quantity: number;
  ratePerKg: number;
  quantityError?: string;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CURRENCIES = [
  { value: "INR", symbol: "₹", label: "INR (₹)" },
  { value: "USD", symbol: "$", label: "USD ($)" },
  { value: "EUR", symbol: "€", label: "EUR (€)" },
];

function currencySymbol(c: string) {
  return CURRENCIES.find((x) => x.value === c)?.symbol ?? "₹";
}

export default function OrderManual() {
  const { currentUser, isOwnerAdmin, products, suppliers, addOrder, addSupplier, getPreviousRate } = useStore();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  
  const canWrite = isOwnerAdmin() || currentUser?.moduleAccess.find(m => m.moduleName === "Orders")?.write === true;
  if (!canWrite) return <Navigate to="/orders" replace />;
  const importedOrder = location.state?.importedOrder;
  const prefillCustomerId = location.state?.customerId;
  const prefillProductIds = location.state?.productIds as string[];

  const [localSuppliers, setLocalSuppliers] = useState(suppliers);
  const [newSupplierOpen, setNewSupplierOpen] = useState(false);
  const [newSupplierData, setNewSupplierData] = useState({ name: "", contactNumber: "" });
  const [productPickerOpen, setProductPickerOpen] = useState(false);

  const [selectedSupplier, setSelectedSupplier] = useState(importedOrder?.supplierId || prefillCustomerId || "");
  const [selectedProducts, setSelectedProducts] = useState<OrderProduct[]>(
    importedOrder?.products || 
    (prefillProductIds ? prefillProductIds.map(id => {
      const p = products.find(prod => prod.id === id);
      return { productId: id, productName: p?.name || "", quantity: 0, ratePerKg: 0 };
    }).filter(p => p.productName) : [])
  );
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [currency, setCurrency] = useState(importedOrder?.currency || "INR");
  const [preferredContainers, setPreferredContainers] = useState<string[]>([]);
  const [notes, setNotes] = useState(importedOrder?.notes || "");
  const [repeatOrder, setRepeatOrder] = useState(false);
  const [repeatConfig, setRepeatConfig] = useState({
    startDate: new Date().toISOString().split("T")[0],
    recurrenceType: "monthly" as "monthly" | "weekly",
    weekDays: [] as number[],
  });

  const finishedGoods = products.filter((p) => p.type === "finished_good");

  // Available containers for selected products (union of all)
  const availableContainers = useMemo(() => {
    const ctIds = new Set(
      selectedProducts.flatMap((sp) => {
        const prod = products.find((p) => p.id === sp.productId);
        return prod?.containerTypes || [];
      })
    );
    return products.filter((ct) => ctIds.has(ct.id));
  }, [selectedProducts, products]);

  // Total amount (live)
  const totalAmount = selectedProducts.reduce(
    (sum, p) => sum + (p.quantity || 0) * (p.ratePerKg || 0),
    0
  );

  // ── Product handlers ─────────────────────────────────────────────────────────
  const addProduct = (productId: string) => {
    if (!selectedProducts.find((p) => p.productId === productId)) {
      const product = products.find((p) => p.id === productId);
      if (product) {
        setSelectedProducts((prev) => [
          ...prev,
          { productId, productName: product.name, quantity: 0, ratePerKg: 0 },
        ]);
      }
    }
    setProductPickerOpen(false);
  };

  const removeProduct = (productId: string) => {
    setSelectedProducts((prev) => prev.filter((p) => p.productId !== productId));
    // Remove related preferred containers
    const prod = products.find((p) => p.id === productId);
    if (prod?.containerTypes) {
      setPreferredContainers((prev) =>
        prev.filter((id) => !prod.containerTypes!.includes(id))
      );
    }
  };

  const updateProduct = (idx: number, field: string, value: any) => {
    setSelectedProducts((prev) => {
      const updated = [...prev];
      if (field === "quantity") {
        const isInteger = Number.isInteger(Number(value));
        updated[idx] = {
          ...updated[idx],
          quantity: Number(value),
          quantityError: !isInteger || value <= 0 ? "Must be a positive whole number" : undefined,
        };
      } else {
        updated[idx] = { ...updated[idx], [field]: value };
      }
      return updated;
    });
  };

  // ── Supplier handlers ────────────────────────────────────────────────────────
  const handleAddSupplier = async () => {
    if (!newSupplierData.name.trim()) return;
    try {
      const supplier = await addSupplier({
        name: newSupplierData.name.trim(),
        address: "",
        contactNumber: newSupplierData.contactNumber,
        type: "customer",
        leadSource: "",
      });
      setLocalSuppliers((prev) => [...prev, supplier]);
      setSelectedSupplier(supplier.id);
      setNewSupplierOpen(false);
      setNewSupplierData({ name: "", contactNumber: "" });
    } catch (err: any) {
      toast({ title: "Error adding supplier", description: err.message, variant: "destructive" });
    }
  };

  // ── Validation ───────────────────────────────────────────────────────────────
  const hasErrors = selectedProducts.some((p) => !!p.quantityError);
  const isValid =
    !!selectedSupplier &&
    selectedProducts.length > 0 &&
    selectedProducts.every(
      (p) => p.quantity > 0 && p.ratePerKg > 0 && !p.quantityError
    ) &&
    !hasErrors;

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;

    const supplier = localSuppliers.find((s) => s.id === selectedSupplier);
    const orderProducts = selectedProducts.map((p) => ({
      productId: p.productId,
      productName: p.productName,
      quantity: p.quantity,
      ratePerKg: p.ratePerKg,
      previousRate: getPreviousRate(selectedSupplier, p.productId) ?? undefined,
    }));

    try {
      await addOrder({
        supplierId: selectedSupplier,
        supplierName: supplier?.name ?? "",
        products: orderProducts,
        totalAmount,
        currency: currency as "INR" | "USD" | "EUR",
        date: new Date(date),
        status: "pending",
        notes: notes || undefined,
        preferredContainers: preferredContainers.length > 0 ? preferredContainers : undefined,
        repeatOrder: repeatOrder
          ? {
              enabled: true,
              startDate: new Date(repeatConfig.startDate),
              recurrenceType: repeatConfig.recurrenceType,
              weekDays: repeatConfig.recurrenceType === "weekly" ? repeatConfig.weekDays : undefined,
            }
          : undefined,
      });

      toast({ title: "Order created", description: `Order for ${supplier?.name} has been created.` });
      navigate("/orders");
    } catch (err: any) {
      toast({ title: "Error creating order", description: err.message, variant: "destructive" });
    }
  };

  const selectedSupplierName = localSuppliers.find((s) => s.id === selectedSupplier)?.name;

  return (
    <div className="w-full">
      <div className="px-4 md:px-6 py-6 max-w-2xl mx-auto">
        {/* Header */}
        <Link to="/orders/new" className="inline-flex items-center gap-2 text-primary hover:opacity-75 transition-opacity mb-6 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" />
          Back to Order Type
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Manual Add Order</h1>
          <p className="text-sm text-muted-foreground mt-1">Fill in the details to create a new order</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ── 1. Supplier/Customer ── */}
          <div className="card-elevated p-5">
            <Label className="field-label">Supplier / Customer <span className="text-destructive">*</span></Label>
            <div className="flex gap-2">
              <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select or search supplier..." />
                </SelectTrigger>
                <SelectContent>
                  {localSuppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" size="icon" onClick={() => setNewSupplierOpen(true)} title="Add new supplier">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* ── 2. Products ── */}
          <div className="card-elevated p-5">
            <Label className="field-label">Products <span className="text-destructive">*</span></Label>
            {selectedProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground mb-3">No products selected yet</p>
            ) : (
              <div className="space-y-3 mb-4">
                {selectedProducts.map((prod, idx) => {
                  const prevRate = selectedSupplier
                    ? getPreviousRate(selectedSupplier, prod.productId)
                    : null;
                  return (
                    <div key={prod.productId} className="p-4 bg-secondary/50 rounded-xl border border-border/50">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-semibold text-sm">{prod.productName}</p>
                        <button type="button" onClick={() => removeProduct(prod.productId)} className="text-muted-foreground hover:text-destructive transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Quantity (kg) * <span className="text-[10px]">(whole numbers)</span></Label>
                          <Input
                            type="number"
                            min="1"
                            step="1"
                            value={prod.quantity || ""}
                            onChange={(e) => updateProduct(idx, "quantity", e.target.value)}
                            placeholder="0"
                            className={cn(prod.quantityError && "border-destructive focus-visible:ring-destructive")}
                          />
                          {prod.quantityError && (
                            <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> {prod.quantityError}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Rate/kg ({currencySymbol(currency)}) *</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={prod.ratePerKg || ""}
                            onChange={(e) => updateProduct(idx, "ratePerKg", parseFloat(e.target.value) || 0)}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                      {prevRate !== null && (
                        <div className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary rounded-md px-2 py-1.5">
                          <Info className="w-3 h-3 flex-shrink-0" />
                          <span>Previous rate from this supplier: <span className="font-semibold text-foreground">{currencySymbol(currency)}{prevRate}/kg</span></span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <Button type="button" variant="outline" size="sm" className="w-full gap-2" onClick={() => setProductPickerOpen(true)}>
              <Plus className="w-4 h-4" /> Add Product
            </Button>
          </div>

          {/* ── 3. Date ── */}
          <div className="card-elevated p-5">
            <Label className="field-label">Order Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>



          {/* ── 5. Preferred Containers ── */}
          {availableContainers.length > 0 && (
            <div className="card-elevated p-5">
              <Label className="field-label">Preferred Containers</Label>
              <div className="space-y-2">
                {availableContainers.map((ct) => (
                  <label key={ct.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary cursor-pointer transition-colors">
                    <Checkbox
                      checked={preferredContainers.includes(ct.id)}
                      onCheckedChange={(checked) => {
                        setPreferredContainers((prev) =>
                          checked ? [...prev, ct.id] : prev.filter((id) => id !== ct.id)
                        );
                      }}
                    />
                    <span className="text-sm">{ct.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* ── 6. Notes ── */}
          <div className="card-elevated p-5">
            <Label className="field-label">Notes</Label>
            <div className="relative">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes for this order..."
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring transition-colors pb-10"
              />
              <div className="absolute bottom-2 left-2 flex items-center gap-2">
                <Button type="button" variant="secondary" size="icon" className="w-8 h-8 rounded-full" onClick={() => {
                  handleAudioCapture((file) => {
                    setNotes(prev => prev ? prev + `\n[Audio attached: ${file.name}]` : `[Audio attached: ${file.name}]`);
                    toast({ title: "Audio attached", description: "Audio reference added to notes." });
                  });
                }}>
                  <Mic className="w-4 h-4" />
                </Button>
                <Button type="button" variant="secondary" size="icon" className="w-8 h-8 rounded-full" onClick={() => {
                  handleCameraCapture((file) => {
                    setNotes(prev => prev ? prev + `\n[Image attached: ${file.name}]` : `[Image attached: ${file.name}]`);
                    toast({ title: "Image attached", description: "Image reference added to notes." });
                  });
                }}>
                  <Camera className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* ── 7. Total Amount (read-only) ── */}
          <div className="card-elevated p-5 bg-primary/5 border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Amount</p>
              </div>
              <p className="text-3xl font-bold text-foreground tracking-tight">
                {currencySymbol(currency)}{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* ── 8. Repeat Order ── */}
          <div className="card-elevated p-5">
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox
                checked={repeatOrder}
                onCheckedChange={(v) => setRepeatOrder(v as boolean)}
              />
              <div>
                <p className="text-sm font-semibold">Enable Repeat Order</p>
                {selectedSupplierName && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Repeat alert for {selectedSupplierName}
                  </p>
                )}
              </div>
            </label>

            {repeatOrder && (
              <div className="mt-4 pt-4 border-t border-border space-y-4">
                <div>
                  <Label className="field-label">Start Date</Label>
                  <Input
                    type="date"
                    value={repeatConfig.startDate}
                    onChange={(e) => setRepeatConfig({ ...repeatConfig, startDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="field-label">Recurrence Type</Label>
                  <Select
                    value={repeatConfig.recurrenceType}
                    onValueChange={(v: any) => setRepeatConfig({ ...repeatConfig, recurrenceType: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Every Month</SelectItem>
                      <SelectItem value="weekly">Every Week</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {repeatConfig.recurrenceType === "weekly" && (
                  <div>
                    <Label className="field-label">Select Days</Label>
                    <div className="grid grid-cols-7 gap-1.5">
                      {DAYS.map((day, idx) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            const days = repeatConfig.weekDays.includes(idx)
                              ? repeatConfig.weekDays.filter((d) => d !== idx)
                              : [...repeatConfig.weekDays, idx];
                            setRepeatConfig({ ...repeatConfig, weekDays: days });
                          }}
                          className={cn(
                            "py-2 rounded-lg text-xs font-semibold transition-all",
                            repeatConfig.weekDays.includes(idx)
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary hover:bg-secondary/70"
                          )}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <p className="text-xs text-muted-foreground bg-secondary/50 rounded-lg p-2.5">
                  💡 You'll receive an alert if a repeat order from {selectedSupplierName || "this supplier"} is not received around the scheduled date.
                </p>
              </div>
            )}
          </div>

          {/* ── Submit ── */}
          <div className="flex gap-3 pt-2">
            <Link to="/orders" className="flex-1">
              <Button type="button" variant="outline" className="w-full">Cancel</Button>
            </Link>
            <Button type="submit" className="flex-1" disabled={!isValid}>
              Create Order
            </Button>
          </div>
        </form>
      </div>

      {/* ── New Supplier Dialog ── */}
      <Dialog open={newSupplierOpen} onOpenChange={setNewSupplierOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add New Supplier</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="field-label">Name <span className="text-destructive">*</span></Label>
              <Input
                value={newSupplierData.name}
                onChange={(e) => setNewSupplierData({ ...newSupplierData, name: e.target.value })}
                placeholder="Supplier name"
              />
            </div>
            <div>
              <Label className="field-label">Contact Number</Label>
              <Input
                value={newSupplierData.contactNumber}
                onChange={(e) => setNewSupplierData({ ...newSupplierData, contactNumber: e.target.value })}
                placeholder="+91-..."
              />
            </div>
            <p className="text-xs text-muted-foreground">Supplier will be saved permanently on order creation.</p>
            <div className="flex gap-2 pt-2 border-t border-border">
              <Button variant="outline" className="flex-1" onClick={() => setNewSupplierOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleAddSupplier} disabled={!newSupplierData.name.trim()}>Add Supplier</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Product Picker Dialog ── */}
      <Dialog open={productPickerOpen} onOpenChange={setProductPickerOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Select Product</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {finishedGoods
              .filter((p) => !selectedProducts.find((sp) => sp.productId === p.id))
              .map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addProduct(product.id)}
                  className="w-full p-3 text-left rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-all"
                >
                  <p className="text-sm font-semibold">{product.name}</p>
                  {product.containerTypes && product.containerTypes.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {product.containerTypes.length} container type{product.containerTypes.length !== 1 ? "s" : ""}
                    </p>
                  )}
                </button>
              ))}
            {finishedGoods.every((p) => selectedProducts.find((sp) => sp.productId === p.id)) && (
              <p className="text-sm text-muted-foreground text-center py-6">All products already added</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
