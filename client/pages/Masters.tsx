import { useState } from "react";
import { useStore } from "@/lib/store";
import { Product, Employee, Supplier, ProductType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Eye, EyeOff, Package, Users, Building2, AlertCircle, Trash2, Edit2, Power, MoreVertical, Search, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const MODULES = ["Dashboard", "Orders", "Inventory", "Masters", "Notes", "Leads", "Logs"];

const SUPPLIER_TYPE_MAP: Record<string, string> = {
  customer: "Customer",
  agent: "Agent",
  raw_material_supplier: "Raw Material Supplier",
};

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    customer: "bg-blue-50 text-blue-700 border-blue-200",
    agent: "bg-purple-50 text-purple-700 border-purple-200",
    raw_material_supplier: "bg-green-50 text-green-700 border-green-200",
  };
  return (
    <span className={cn("text-xs px-2.5 py-1 rounded-full border font-medium", colors[type] ?? "bg-secondary text-muted-foreground border-border")}>
      {SUPPLIER_TYPE_MAP[type] ?? type}
    </span>
  );
}

export default function Masters() {
  const { currentUser, products, employees, suppliers, addProduct, updateProduct, deleteProduct, addEmployee, updateEmployee, deleteEmployee, addSupplier, updateSupplier, deleteSupplier, isOwnerAdmin } = useStore();
  const canWrite = isOwnerAdmin() || currentUser?.moduleAccess.find(m => m.moduleName === "Masters")?.write === true;
  const { toast } = useToast();

  // ── Product state ────────────────────────────────────────────────────────────
  const [productFilter, setProductFilter] = useState<ProductType>("finished_good");
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({ name: "", type: "finished_good" as ProductType, containerTypeIds: [] as string[], alertThreshold: 100, isContainer: false, capacity: "", unit: "kg" });
  const [productNameError, setProductNameError] = useState("");

  // ── Employee state ───────────────────────────────────────────────────────────
  const [empDialogOpen, setEmpDialogOpen] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [empForm, setEmpForm] = useState({
    name: "", phoneNumber: "", address: "", designation: "",
    moduleAccess: MODULES.reduce((acc, m) => ({ ...acc, [m]: { read: false, write: false } }), {} as Record<string, { read: boolean; write: boolean }>),
    password: "", confirmPassword: "", showPassword: false,
  });
  const [passwordError, setPasswordError] = useState("");

  // ── Supplier state ───────────────────────────────────────────────────────────
  const [suppDialogOpen, setSuppDialogOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [suppForm, setSuppForm] = useState({ name: "", address: "", contactNumber: "", leadSource: "", type: "customer" });
  const [newTypeDialogOpen, setNewTypeDialogOpen] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [supplierTypeFilter, setSupplierTypeFilter] = useState<string>("all");
  
  const [newUnitDialogOpen, setNewUnitDialogOpen] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");
  const [customUnits, setCustomUnits] = useState<string[]>([]);

  // ── Search state ─────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  // ── Product handlers ─────────────────────────────────────────────────────────
  const handleSaveProduct = async () => {
    if (!productForm.name.trim()) { setProductNameError("Name is required"); return; }
    
    
    try {
      if (editingProductId) {
        await updateProduct(editingProductId, {
          name: productForm.name.trim(), 
          type: productForm.type, 
          containerTypes: productForm.type === "finished_good" ? productForm.containerTypeIds : undefined,
          alertThreshold: productForm.alertThreshold,
          isContainer: productForm.type === "raw_material" ? productForm.isContainer : undefined,
          capacity: productForm.type === "raw_material" && productForm.isContainer ? parseFloat(productForm.capacity) || 0 : undefined,
          unit: productForm.type === "raw_material" ? productForm.unit : "kg"
        });
        toast({ title: "Product updated" });
      } else {
        await addProduct({ 
          name: productForm.name.trim(), 
          type: productForm.type, 
          containerTypes: productForm.type === "finished_good" ? productForm.containerTypeIds : undefined,
          alertThreshold: productForm.alertThreshold,
          isContainer: productForm.type === "raw_material" ? productForm.isContainer : undefined,
          capacity: productForm.type === "raw_material" && productForm.isContainer ? parseFloat(productForm.capacity) || 0 : undefined,
          unit: productForm.type === "raw_material" ? productForm.unit : "kg"
        });
        toast({ title: "Product added" });
      }
      
      setProductDialogOpen(false);
      setProductForm({ name: "", type: "finished_good", containerTypeIds: [], alertThreshold: 100, isContainer: false, capacity: "", unit: "kg" });
      setEditingProductId(null);
      setProductNameError("");
    } catch (err: any) {
      toast({ title: "Error saving product", description: err.message, variant: "destructive" });
    }
  };

  const openAddProductModal = () => {
    setEditingProductId(null);
    setProductForm({ name: "", type: "finished_good", containerTypeIds: [], alertThreshold: 100, isContainer: false, capacity: "", unit: "kg" });
    setProductNameError("");
    setProductDialogOpen(true);
  };

  const handleEditProductClick = (product: Product) => {
    setEditingProductId(product.id);
    setProductForm({
      name: product.name,
      type: product.type,
      containerTypeIds: product.containerTypes || [],
      alertThreshold: product.alertThreshold || 100,
      isContainer: product.isContainer || false,
      capacity: product.capacity ? String(product.capacity) : "",
      unit: product.unit || "kg"
    });
    setProductNameError("");
    setProductDialogOpen(true);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      await deleteProduct(id);
      toast({ title: "Product deleted" });
    } catch (err: any) {
      toast({ title: "Error deleting product", description: err.message, variant: "destructive" });
    }
  };


  // ── Employee handlers ────────────────────────────────────────────────────────
  const validatePass = (p: string, isEdit: boolean) => {
    if (isEdit && !p) return "";
    if (p.length < 8) return "Minimum 8 characters";
    if (!/\d/.test(p)) return "At least 1 number required";
    if (!/[a-zA-Z]/.test(p)) return "At least 1 letter required";
    return "";
  };

  const handleAddEmployee = async () => {
    const isOwner = empForm.designation.toLowerCase() === "owner";
    const passErr = validatePass(empForm.password, !!editingEmployeeId);
    if (passErr) { setPasswordError(passErr); return; }
    if (empForm.password || !editingEmployeeId) {
      if (empForm.password !== empForm.confirmPassword) { setPasswordError("Passwords do not match"); return; }
    }
    if (!empForm.name.trim() || !empForm.phoneNumber.trim()) return;
    
    // Only check for duplicate phone number if we are adding a new employee, or editing and changing the phone number
    const dupPhone = employees.find(e => e.phoneNumber === empForm.phoneNumber.trim() && e.id !== editingEmployeeId);
    if (dupPhone) { setPasswordError("Phone number already in use"); return; }

    const finalModuleAccess = isOwner 
      ? MODULES.map(m => ({ moduleName: m, read: true, write: true })) 
      : MODULES.map(m => ({ moduleName: m, ...empForm.moduleAccess[m] }));

    try {
      if (editingEmployeeId) {
        await updateEmployee(editingEmployeeId, {
          name: empForm.name.trim(),
          phoneNumber: empForm.phoneNumber.trim(),
          address: empForm.address,
          designation: empForm.designation,
          moduleAccess: finalModuleAccess,
          password: empForm.password ? `hashed_${empForm.password}` : "",
        });
        toast({ title: "Employee updated" });
      } else {
        await addEmployee({
          name: empForm.name.trim(),
          phoneNumber: empForm.phoneNumber.trim(),
          address: empForm.address,
          designation: empForm.designation,
          moduleAccess: finalModuleAccess,
          password: `hashed_${empForm.password}`,
        });
        toast({ title: "Employee added" });
      }
      setEmpDialogOpen(false);
      setEditingEmployeeId(null);
      setEmpForm({ name: "", phoneNumber: "", address: "", designation: "", moduleAccess: MODULES.reduce((acc, m) => ({ ...acc, [m]: { read: false, write: false } }), {}), password: "", confirmPassword: "", showPassword: false });
      setPasswordError("");
    } catch (err: any) {
      toast({ title: "Error adding employee", description: err.message, variant: "destructive" });
    }
  };

  const openAddEmployeeModal = () => {
    setEditingEmployeeId(null);
    setEmpForm({ name: "", phoneNumber: "", address: "", designation: "", moduleAccess: MODULES.reduce((acc, m) => ({ ...acc, [m]: { read: false, write: false } }), {}), password: "", confirmPassword: "", showPassword: false });
    setPasswordError("");
    setEmpDialogOpen(true);
  };

  const handleEditEmployeeClick = (employee: Employee) => {
    setEditingEmployeeId(employee.id);
    const modAcc = MODULES.reduce((acc, m) => {
      const p = employee.moduleAccess.find(ma => ma.moduleName === m);
      return { ...acc, [m]: { read: p?.read || false, write: p?.write || false } };
    }, {});
    
    setEmpForm({
      name: employee.name,
      phoneNumber: employee.phoneNumber,
      address: employee.address || "",
      designation: employee.designation || "",
      moduleAccess: modAcc as any,
      password: "",
      confirmPassword: "",
      showPassword: false
    });
    setPasswordError("");
    setEmpDialogOpen(true);
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    if (employee.designation.toLowerCase() === "owner") {
      toast({ title: "Cannot delete owner", variant: "destructive" });
      return;
    }
    if (!confirm(`Are you sure you want to delete employee ${employee.name}?`)) return;
    try {
      await deleteEmployee(employee.id);
      toast({ title: "Employee deleted" });
    } catch (err: any) {
      toast({ title: "Error deleting employee", description: err.message, variant: "destructive" });
    }
  };

  const handleToggleEmployeeStatus = async (employee: Employee) => {
    if (employee.designation.toLowerCase() === "owner" && employee.isActive !== false) {
      toast({ title: "Cannot deactivate owner", variant: "destructive" });
      return;
    }
    try {
      await updateEmployee(employee.id, {
        name: employee.name,
        phoneNumber: employee.phoneNumber,
        address: employee.address,
        designation: employee.designation,
        moduleAccess: employee.moduleAccess,
        password: "",
        isActive: !(employee.isActive ?? true),
      });
      toast({ title: `Employee ${employee.isActive !== false ? "deactivated" : "activated"}` });
    } catch (err: any) {
      toast({ title: "Error toggling status", description: err.message, variant: "destructive" });
    }
  };

  // ── Supplier handlers ────────────────────────────────────────────────────────
  const handleAddSupplier = async () => {
    if (!suppForm.name.trim()) return;
    try {
      if (editingSupplierId) {
        await updateSupplier(editingSupplierId, { name: suppForm.name.trim(), address: suppForm.address, contactNumber: suppForm.contactNumber, leadSource: suppForm.leadSource, type: suppForm.type });
        toast({ title: "Supplier updated" });
      } else {
        await addSupplier({ name: suppForm.name.trim(), address: suppForm.address, contactNumber: suppForm.contactNumber, leadSource: suppForm.leadSource, type: suppForm.type });
        toast({ title: "Supplier added" });
      }
      setSuppDialogOpen(false);
      setEditingSupplierId(null);
      setSuppForm({ name: "", address: "", contactNumber: "", leadSource: "", type: "customer" });
    } catch (err: any) {
      toast({ title: "Error saving supplier", description: err.message, variant: "destructive" });
    }
  };

  const openAddSupplierModal = () => {
    setEditingSupplierId(null);
    setSuppForm({ name: "", address: "", contactNumber: "", leadSource: "", type: "customer" });
    setSuppDialogOpen(true);
  };

  const handleDeleteSupplier = async (supplier: Supplier) => {
    if (!confirm(`Are you sure you want to delete supplier ${supplier.name}?`)) return;
    try {
      await deleteSupplier(supplier.id);
      toast({ title: "Supplier deleted" });
    } catch (err: any) {
      toast({ title: "Error deleting supplier", description: err.message, variant: "destructive" });
    }
  };

  const handleToggleSupplierStatus = async (supplier: Supplier) => {
    try {
      await updateSupplier(supplier.id, {
        name: supplier.name,
        address: supplier.address,
        contactNumber: supplier.contactNumber,
        leadSource: supplier.leadSource,
        type: supplier.type,
        isActive: !(supplier.isActive ?? true),
      });
      toast({ title: `Supplier ${supplier.isActive !== false ? "deactivated" : "activated"}` });
    } catch (err: any) {
      toast({ title: "Error toggling status", description: err.message, variant: "destructive" });
    }
  };

  const handleEditSupplierClick = (supplier: Supplier) => {
    setEditingSupplierId(supplier.id);
    setSuppForm({
      name: supplier.name,
      address: supplier.address || "",
      contactNumber: supplier.contactNumber || "",
      leadSource: supplier.leadSource || "",
      type: supplier.type || "customer"
    });
    setSuppDialogOpen(true);
  };

  const handleAddCustomType = () => {
    if (!newTypeName.trim()) return;
    setCustomTypes(p => [...p, newTypeName.trim()]);
    setSuppForm(f => ({ ...f, type: newTypeName.trim() }));
    setNewTypeName("");
    setNewTypeDialogOpen(false);
  };

  const handleAddCustomUnit = () => {
    if (!newUnitName.trim()) return;
    setCustomUnits(p => [...p, newUnitName.trim()]);
    setProductForm(f => ({ ...f, unit: newUnitName.trim() }));
    setNewUnitName("");
    setNewUnitDialogOpen(false);
  };

  const filteredProducts = products.filter(p => 
    p.type === productFilter && 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full">
      <div className="px-4 md:px-6 pt-6 pb-4 flex items-center justify-between relative">
        <div className="shrink-0">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Masters</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage core business data</p>
        </div>
        
        <div className="flex-1 flex justify-end">
          <div className="relative flex items-center justify-end">
            {/* Desktop search is always visible */}
            <div className="hidden md:flex relative items-center w-64">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3" />
              <Input 
                placeholder="Search by name..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 w-full" 
              />
              {searchQuery && (
                <Button variant="ghost" size="icon" className="absolute right-1 w-7 h-7" onClick={() => setSearchQuery("")}>
                  <X className="w-4 h-4 text-muted-foreground" />
                </Button>
              )}
            </div>

            {/* Mobile search logic */}
            <div className="md:hidden flex items-center">
              {!isSearchExpanded ? (
                <Button variant="ghost" size="icon" onClick={() => setIsSearchExpanded(true)}>
                  <Search className="w-5 h-5 text-muted-foreground" />
                </Button>
              ) : (
                <div className="relative flex items-center w-36 sm:w-48 animate-in fade-in slide-in-from-right-2 duration-200">
                  <Search className="w-4 h-4 text-muted-foreground absolute left-3" />
                  <Input 
                    placeholder="Search..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-9 pr-8 w-full" 
                    autoFocus
                  />
                  <Button variant="ghost" size="icon" className="absolute right-1 w-7 h-7" onClick={() => {
                    setSearchQuery("");
                    setIsSearchExpanded(false);
                  }}>
                    <X className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 pb-8">
        <Tabs defaultValue="products" className="w-full">
          <TabsList className="grid w-full grid-cols-3 max-w-sm mb-6">
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="employees">Employees</TabsTrigger>
            <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          </TabsList>

          {/* ─── PRODUCTS ─────────────────────────────────────────────────────── */}
          <TabsContent value="products" className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Product Master</h2>
              {canWrite && (
                <Dialog open={productDialogOpen} onOpenChange={(open) => {
                  setProductDialogOpen(open);
                  if (!open) {
                    setEditingProductId(null);
                    setProductForm({ name: "", type: "finished_good", containerTypeIds: [], alertThreshold: 100, isContainer: false, capacity: "", unit: "kg" });
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button className="gap-2 shadow-sm" onClick={openAddProductModal}>
                      <Plus className="w-4 h-4" /> Add Product
                    </Button>
                  </DialogTrigger>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>{editingProductId ? "Edit Product" : "Add New Product"}</DialogTitle></DialogHeader>
                  <div className="space-y-5">
                    <div>
                      <Label className="field-label">Product Name <span className="text-destructive">*</span></Label>
                      <Input value={productForm.name} onChange={e => { setProductForm(f => ({ ...f, name: e.target.value })); setProductNameError(""); }} placeholder="Product name" className={cn(productNameError && "border-destructive")} />
                      {productNameError && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{productNameError}</p>}
                    </div>
                    <div>
                      <Label className="field-label">Type <span className="text-destructive">*</span></Label>
                      <RadioGroup value={productForm.type} onValueChange={v => setProductForm(f => ({ ...f, type: v as ProductType, containerTypeIds: [] }))} className="flex gap-4">
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="finished_good" id="fg" />
                          <Label htmlFor="fg" className="cursor-pointer font-normal">Finished Good</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="raw_material" id="rm" />
                          <Label htmlFor="rm" className="cursor-pointer font-normal">Raw Material</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {productForm.type === "finished_good" && (
                      <div>
                        <Label className="field-label">Container Types</Label>
                        <div className="space-y-1.5 mb-3 max-h-44 overflow-y-auto pr-1">
                          {products.filter(p => p.type === "raw_material" && p.isContainer).map(ct => (
                            <label key={ct.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary cursor-pointer transition-colors">
                              <Checkbox checked={productForm.containerTypeIds.includes(ct.id)} onCheckedChange={checked => {
                                setProductForm(f => ({ ...f, containerTypeIds: checked ? [...f.containerTypeIds, ct.id] : f.containerTypeIds.filter(id => id !== ct.id) }));
                              }} />
                              <span className="text-sm">{ct.name} {ct.capacity ? `(${ct.capacity}kg)` : ""}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    {productForm.type === "raw_material" && (
                      <div className="space-y-4">
                        <div>
                          <Label className="field-label">Unit <span className="text-destructive">*</span></Label>
                          <div className="flex gap-2">
                            <Select value={productForm.unit} onValueChange={v => setProductForm(f => ({ ...f, unit: v }))}>
                              <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="kg">kg</SelectItem>
                                <SelectItem value="ltr">ltr</SelectItem>
                                <SelectItem value="pcs">pcs</SelectItem>
                                {customUnits.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            <Dialog open={newUnitDialogOpen} onOpenChange={setNewUnitDialogOpen}>
                              <DialogTrigger asChild>
                                <Button variant="outline" size="icon"><Plus className="w-4 h-4" /></Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-xs">
                                <DialogHeader><DialogTitle>Add Custom Unit</DialogTitle></DialogHeader>
                                <div className="space-y-4">
                                  <Input value={newUnitName} onChange={e => setNewUnitName(e.target.value)} placeholder="Custom unit (e.g., g, ml)" autoFocus />
                                  <div className="flex gap-2">
                                    <Button variant="outline" className="flex-1" onClick={() => setNewUnitDialogOpen(false)}>Cancel</Button>
                                    <Button className="flex-1" onClick={handleAddCustomUnit} disabled={!newUnitName.trim()}>Add</Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer border p-3 rounded-lg hover:bg-secondary/50">
                          <Checkbox checked={productForm.isContainer} onCheckedChange={(checked) => setProductForm(f => ({ ...f, isContainer: checked as boolean }))} />
                          <div className="space-y-1">
                            <p className="text-sm font-medium">Use as Container</p>
                            <p className="text-xs text-muted-foreground">Allows this material to be used to pack finished goods.</p>
                          </div>
                        </label>
                        {productForm.isContainer && (
                          <div>
                            <Label className="field-label">Capacity (kg) <span className="text-destructive">*</span></Label>
                            <Input type="number" step="any" min="0" value={productForm.capacity} onChange={(e) => setProductForm(f => ({ ...f, capacity: e.target.value }))} placeholder="e.g. 50" />
                          </div>
                        )}
                      </div>
                    )}

                    <div>
                      <Label className="field-label">Alert Threshold ({productForm.type === "raw_material" ? productForm.unit : "kg"})</Label>
                      <Input 
                        type="number" 
                        min="0"
                        step="any"
                        value={productForm.alertThreshold} 
                        onChange={e => setProductForm(f => ({ ...f, alertThreshold: parseFloat(e.target.value) || 0 }))} 
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">Triggers low stock alerts when inventory falls below this amount.</p>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-border">
                      <Button variant="outline" className="flex-1" onClick={() => setProductDialogOpen(false)}>Cancel</Button>
                      <Button className="flex-1" onClick={handleSaveProduct}>{editingProductId ? "Update Product" : "Add Product"}</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              )}
            </div>

            <Tabs value={productFilter} onValueChange={v => setProductFilter(v as ProductType)}>
              <TabsList className="grid w-full grid-cols-2 max-w-xs">
                <TabsTrigger value="finished_good">Finished Goods</TabsTrigger>
                <TabsTrigger value="raw_material">Raw Material</TabsTrigger>
              </TabsList>
            </Tabs>

            {filteredProducts.length === 0 ? (
              <div className="empty-state"><Package className="w-10 h-10 text-muted-foreground/30 mb-3" /><p className="text-muted-foreground">No {productFilter === "finished_good" ? "finished goods" : "raw materials"} yet</p></div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredProducts.map(p => (
                  <div key={p.id} className="card-elevated p-4 hover:border-primary/30 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-foreground text-sm leading-snug">{p.name}</h3>
                      {canWrite && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleEditProductClick(p)} className="text-muted-foreground hover:text-primary hover:bg-primary/10 p-1.5 rounded transition-colors" title="Edit Product">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDeleteProduct(p.id)} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 p-1.5 rounded transition-colors" title="Delete Product">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
                      <span>{p.type === "finished_good" ? "Finished Good" : "Raw Material"}</span>
                      {p.alertThreshold !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                          <span><span className="font-medium text-foreground">{p.alertThreshold} {p.unit || 'kg'}</span> Threshold</span>
                        </div>
                      )}
                      {p.isContainer && (
                        <div className="flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-primary/40" />
                          <span className="text-primary font-medium">Container ({p.capacity} {p.unit || 'kg'})</span>
                        </div>
                      )}
                    </div>
                    {p.containerTypes && p.containerTypes.length > 0 && (
                      <div className="pt-2.5 border-t border-border/60">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Containers</p>
                        <div className="flex flex-wrap gap-1">
                          {p.containerTypes.map(ctId => {
                            const ct = products.find(c => c.id === ctId);
                            return ct ? <span key={ctId} className="text-[11px] px-2 py-0.5 bg-secondary rounded-md">{ct.name} {ct.capacity ? `(${ct.capacity}kg)` : ""}</span> : null;
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ─── EMPLOYEES ────────────────────────────────────────────────────── */}
          <TabsContent value="employees" className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Employee Master</h2>
              {canWrite && (
                <Dialog open={empDialogOpen} onOpenChange={(open) => {
                  setEmpDialogOpen(open);
                  if (!open) {
                    setEditingEmployeeId(null);
                    setEmpForm({ name: "", phoneNumber: "", address: "", designation: "", moduleAccess: MODULES.reduce((acc, m) => ({ ...acc, [m]: { read: false, write: false } }), {}), password: "", confirmPassword: "", showPassword: false });
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button className="gap-2 shadow-sm" onClick={openAddEmployeeModal}><Plus className="w-4 h-4" /> Add Employee</Button>
                  </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>{editingEmployeeId ? "Edit Employee" : "Add New Employee"}</DialogTitle></DialogHeader>
                  <div className="space-y-5">
                    <div className="pb-4 border-b border-border">
                      <h3 className="text-sm font-semibold text-foreground mb-3">Basic Details</h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label className="field-label">Name *</Label><Input value={empForm.name} onChange={e => setEmpForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" /></div>
                        <div><Label className="field-label">Phone (Username) *</Label><Input value={empForm.phoneNumber} onChange={e => setEmpForm(f => ({ ...f, phoneNumber: e.target.value }))} placeholder="+91-..." /></div>
                        <div><Label className="field-label">Address</Label><Input value={empForm.address} onChange={e => setEmpForm(f => ({ ...f, address: e.target.value }))} placeholder="Address" /></div>
                        <div><Label className="field-label">Designation</Label><Input value={empForm.designation} onChange={e => setEmpForm(f => ({ ...f, designation: e.target.value }))} placeholder="e.g., Manager" /></div>
                      </div>
                    </div>

                    <div className="pb-4 border-b border-border">
                      <h3 className="text-sm font-semibold text-foreground mb-3">Module Access</h3>
                      <div className="space-y-1.5">
                        <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground pb-2">
                          <span>Module</span><span>Read</span><span>Write</span>
                        </div>
                        {MODULES.map(mod => (
                          <div key={mod} className="grid grid-cols-3 gap-2 items-center py-1.5 rounded-lg hover:bg-secondary/50 px-1">
                            <span className="text-sm font-medium">{mod}</span>
                            <Checkbox checked={empForm.moduleAccess[mod]?.read} onCheckedChange={v => setEmpForm(f => ({ ...f, moduleAccess: { ...f.moduleAccess, [mod]: { ...f.moduleAccess[mod], read: v as boolean } } }))} />
                            <Checkbox checked={empForm.moduleAccess[mod]?.write} onCheckedChange={v => {
                              const isChecked = v as boolean;
                              setEmpForm(f => ({ 
                                ...f, 
                                moduleAccess: { 
                                  ...f.moduleAccess, 
                                  [mod]: { 
                                    ...f.moduleAccess[mod], 
                                    write: isChecked,
                                    read: isChecked ? true : f.moduleAccess[mod]?.read 
                                  } 
                                } 
                              }));
                            }} />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-3">Login Credentials</h3>
                      <div className="space-y-3">
                        <div><Label className="field-label">Username (Phone)</Label><Input disabled value={empForm.phoneNumber} className="bg-secondary" /></div>
                        <div>
                          <Label className="field-label">Password *</Label>
                          <div className="relative">
                            <Input type={empForm.showPassword ? "text" : "password"} value={empForm.password} onChange={e => { setEmpForm(f => ({ ...f, password: e.target.value })); setPasswordError(""); }} placeholder="Min 8 chars, 1 number, 1 letter" />
                            <button type="button" onClick={() => setEmpForm(f => ({ ...f, showPassword: !f.showPassword }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                              {empForm.showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {passwordError && <p className="text-xs text-destructive mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{passwordError}</p>}
                        </div>
                        <div><Label className="field-label">Confirm Password *</Label><Input type="password" value={empForm.confirmPassword} onChange={e => setEmpForm(f => ({ ...f, confirmPassword: e.target.value }))} placeholder="Confirm password" /></div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-border">
                      <Button variant="outline" className="flex-1" onClick={() => setEmpDialogOpen(false)}>Cancel</Button>
                      <Button className="flex-1" onClick={handleAddEmployee}>{editingEmployeeId ? "Update Employee" : "Add Employee"}</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              )}
            </div>

            <div className="space-y-2.5">
              {employees.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase())).map(emp => (
                <div key={emp.id} className="card-elevated p-4 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2.5 mb-1">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xs font-bold text-primary">{emp.name[0]}</span>
                      </div>
                      <div>
                        <p className="font-semibold text-foreground text-sm">{emp.name}</p>
                        <p className="text-xs text-muted-foreground capitalize">{emp.designation}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground ml-10.5">{emp.phoneNumber}</p>
                    <div className="flex flex-wrap gap-1 mt-2 ml-10.5">
                      {emp.moduleAccess.filter(m => m.write).map(m => (
                        <span key={m.moduleName} className="text-[10px] px-1.5 py-0.5 bg-success/10 text-success rounded font-medium">{m.moduleName}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {emp.isActive === false && (
                      <span className="text-[10px] px-2 py-1 bg-destructive/10 text-destructive rounded-full font-semibold border border-destructive/20 whitespace-nowrap">
                        Inactive
                      </span>
                    )}
                    {(emp.designation === "owner" || emp.designation === "admin") && (
                      <span className="text-[10px] px-2 py-1 bg-warning/10 text-warning rounded-full font-semibold border border-warning/20 whitespace-nowrap">
                        {emp.designation === "owner" ? "Owner" : "Admin"}
                      </span>
                    )}
                    {canWrite && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleToggleEmployeeStatus(emp)} className={cn("p-1.5 rounded transition-colors", emp.isActive !== false ? "text-muted-foreground hover:text-destructive hover:bg-destructive/10" : "text-muted-foreground hover:text-success hover:bg-success/10")} title={emp.isActive !== false ? "Deactivate Employee" : "Activate Employee"}>
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleEditEmployeeClick(emp)} className="text-muted-foreground hover:text-primary hover:bg-primary/10 p-1.5 rounded transition-colors" title="Edit Employee">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteEmployee(emp)} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 p-1.5 rounded transition-colors" title="Delete Employee">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ─── SUPPLIERS ─────────────────────────────────────────────────────── */}
          <TabsContent value="suppliers" className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="section-title">Supplier Master</h2>
              <div className="flex items-center gap-3">
                <Select value={supplierTypeFilter} onValueChange={setSupplierTypeFilter}>
                  <SelectTrigger className="w-[140px] sm:w-[160px] h-9">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="raw_material_supplier">Raw Material Supplier</SelectItem>
                    {customTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
                {canWrite && (
                  <Dialog open={suppDialogOpen} onOpenChange={(open) => {
                    setSuppDialogOpen(open);
                    if (!open) {
                      setEditingSupplierId(null);
                      setSuppForm({ name: "", address: "", contactNumber: "", leadSource: "", type: "customer" });
                    }
                  }}>
                    <DialogTrigger asChild>
                      <Button className="gap-2 shadow-sm h-9" onClick={openAddSupplierModal}><Plus className="w-4 h-4" /> Add</Button>
                    </DialogTrigger>
                  <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>{editingSupplierId ? "Edit Supplier" : "Add New Supplier"}</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label className="field-label">Name *</Label><Input value={suppForm.name} onChange={e => setSuppForm(f => ({ ...f, name: e.target.value }))} placeholder="Supplier name" /></div>
                    <div><Label className="field-label">Address</Label><Input value={suppForm.address} onChange={e => setSuppForm(f => ({ ...f, address: e.target.value }))} placeholder="Address" /></div>
                    <div><Label className="field-label">Contact Number</Label><Input value={suppForm.contactNumber} onChange={e => setSuppForm(f => ({ ...f, contactNumber: e.target.value }))} placeholder="+91-..." /></div>
                    <div><Label className="field-label">Lead Source</Label><Input value={suppForm.leadSource} onChange={e => setSuppForm(f => ({ ...f, leadSource: e.target.value }))} placeholder="e.g., Referral, Trade Show" /></div>
                    <div>
                      <Label className="field-label">Type *</Label>
                      <div className="flex gap-2">
                        <Select value={suppForm.type} onValueChange={v => setSuppForm(f => ({ ...f, type: v }))}>
                          <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="customer">Customer</SelectItem>
                            <SelectItem value="agent">Agent</SelectItem>
                            <SelectItem value="raw_material_supplier">Raw Material Supplier</SelectItem>
                            {customTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Dialog open={newTypeDialogOpen} onOpenChange={setNewTypeDialogOpen}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="icon"><Plus className="w-4 h-4" /></Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-xs">
                            <DialogHeader><DialogTitle>Add Custom Type</DialogTitle></DialogHeader>
                            <div className="space-y-4">
                              <Input value={newTypeName} onChange={e => setNewTypeName(e.target.value)} placeholder="Custom type name" autoFocus />
                              <div className="flex gap-2">
                                <Button variant="outline" className="flex-1" onClick={() => setNewTypeDialogOpen(false)}>Cancel</Button>
                                <Button className="flex-1" onClick={handleAddCustomType} disabled={!newTypeName.trim()}>Add</Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-border">
                      <Button variant="outline" className="flex-1" onClick={() => setSuppDialogOpen(false)}>Cancel</Button>
                      <Button className="flex-1" onClick={handleAddSupplier} disabled={!suppForm.name.trim()}>{editingSupplierId ? "Update Supplier" : "Add Supplier"}</Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              )}
              </div>
            </div>


            <div className="space-y-2.5">
              {suppliers.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()) && (supplierTypeFilter === "all" || s.type === supplierTypeFilter)).map(s => (
                <div key={s.id} className="card-elevated p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-foreground">{s.name}</p>
                      {s.address && <p className="text-xs text-muted-foreground mt-0.5">{s.address}</p>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {s.isActive === false && (
                        <span className="text-[10px] px-2 py-1 bg-destructive/10 text-destructive rounded-full font-semibold border border-destructive/20 whitespace-nowrap">
                          Inactive
                        </span>
                      )}
                      <TypeBadge type={s.type} />
                      {canWrite && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="text-muted-foreground hover:bg-secondary p-1.5 rounded transition-colors" title="Options">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem onClick={() => handleEditSupplierClick(s)} className="cursor-pointer gap-2">
                              <Edit2 className="w-4 h-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleToggleSupplierStatus(s)} className={cn("cursor-pointer gap-2", s.isActive !== false ? "text-destructive" : "text-success")}>
                              <Power className="w-4 h-4" /> {s.isActive !== false ? "Deactivate" : "Activate"}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDeleteSupplier(s)} className="cursor-pointer gap-2 text-destructive">
                              <Trash2 className="w-4 h-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-2">
                    {s.contactNumber && <span>📞 {s.contactNumber}</span>}
                    {s.leadSource && <span>Source: {s.leadSource}</span>}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
