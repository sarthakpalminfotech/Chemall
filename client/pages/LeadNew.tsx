import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Mic, Camera, Plus, X, Edit2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { handleAudioCapture, handleCameraCapture, cn } from "@/lib/utils";
import { LeadIntensity, LeadSource, LeadStatus } from "@/lib/types";

const DEFAULT_SOURCES = ["mail", "website", "direct contact", "agent", "social media"];
const ALL_STATUSES: LeadStatus[] = ["new", "in discussion", "paused/hold", "won", "lost", "disqualified"];

export default function LeadNew() {
  const { id } = useParams<{ id: string }>();
  const { products, leads, addLead, updateLead } = useStore();
  const { toast } = useToast();
  const navigate = useNavigate();

  const existingLead = id ? leads.find(l => l.id === id) : null;
  const [isViewMode, setIsViewMode] = useState(!!existingLead);

  const [companyName, setCompanyName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [contactPersonName, setContactPersonName] = useState("");
  const [contactPersonNumber, setContactPersonNumber] = useState("");
  const [address, setAddress] = useState("");
  
  const [source, setSource] = useState<string>("direct contact");
  const [customSources, setCustomSources] = useState<string[]>([]);
  const [newSourceOpen, setNewSourceOpen] = useState(false);
  const [newSourceText, setNewSourceText] = useState("");

  const [intensity, setIntensity] = useState<LeadIntensity>("moderate");
  const [status, setStatus] = useState<LeadStatus>("new");
  
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  
  const [quantity, setQuantity] = useState<number | "">("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (existingLead) {
      setCompanyName(existingLead.companyName);
      setContactNumber(existingLead.contactNumber);
      setContactPersonName(existingLead.contactPersonName || "");
      setContactPersonNumber(existingLead.contactPersonNumber || "");
      setAddress(existingLead.address || "");
      setSource(existingLead.source);
      setIntensity(existingLead.intensity);
      setStatus((existingLead.status as any) === "active" ? "new" : existingLead.status);
      setSelectedProducts(existingLead.products);
      setQuantity(existingLead.quantity || "");
      setNotes(existingLead.notes || "");
      
      if (!DEFAULT_SOURCES.includes(existingLead.source.toLowerCase())) {
        setCustomSources(prev => prev.includes(existingLead.source) ? prev : [...prev, existingLead.source]);
      }
    }
  }, [existingLead]);

  const finishedGoods = products.filter(p => p.type === "finished_good");
  const filteredProducts = finishedGoods.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()));

  const allSources = [...DEFAULT_SOURCES, ...customSources];

  const handleAddSource = () => {
    if (newSourceText.trim() && !allSources.includes(newSourceText.trim().toLowerCase())) {
      const sourceName = newSourceText.trim().toLowerCase();
      setCustomSources([...customSources, sourceName]);
      setSource(sourceName);
    }
    setNewSourceOpen(false);
    setNewSourceText("");
  };

  const toggleProduct = (pid: string) => {
    if (isViewMode) return;
    setSelectedProducts(prev => 
      prev.includes(pid) ? prev.filter(p => p !== pid) : [...prev, pid]
    );
  };

  const isValid = companyName.trim() && contactNumber.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewMode) return;
    if (!isValid) return;

    try {
      const leadData = {
        companyName: companyName.trim(),
        contactNumber: contactNumber.trim(),
        contactPersonName: contactPersonName.trim() || undefined,
        contactPersonNumber: contactPersonNumber.trim() || undefined,
        address: address.trim() || undefined,
        source: source as LeadSource,
        intensity,
        status,
        products: selectedProducts,
        quantity: quantity ? Number(quantity) : undefined,
        notes: notes.trim() || undefined,
      };

      if (existingLead) {
        await updateLead(existingLead.id, leadData);
        toast({ title: "Lead updated", description: "Lead details have been updated." });
        setIsViewMode(true);
      } else {
        await addLead(leadData);
        toast({ title: "Lead created", description: "Lead has been saved successfully." });
        navigate("/leads");
      }
    } catch (err: any) {
      toast({ title: "Error saving lead", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="w-full pb-8">
      <div className="px-4 md:px-6 py-6 max-w-2xl mx-auto">
        {/* Header */}
        <Link to="/leads" className="inline-flex items-center gap-2 text-primary hover:opacity-75 transition-opacity mb-6 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" />
          Back to Leads
        </Link>

        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              {existingLead ? (isViewMode ? "Lead Details" : "Edit Lead") : "Create New Lead"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {existingLead ? "View or update lead information" : "Enter the details of the prospective client"}
            </p>
          </div>
          {isViewMode && (
            <Button variant="outline" className="gap-2" onClick={() => setIsViewMode(false)}>
              <Edit2 className="w-4 h-4" />
              Edit Lead
            </Button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="card-elevated p-5 space-y-4">
            <h2 className="font-semibold uppercase text-xs tracking-wider text-muted-foreground mb-2">Basic Details</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="field-label">Company Name <span className="text-destructive">*</span></Label>
                <Input disabled={isViewMode} value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Company Ltd" />
              </div>
              <div>
                <Label className="field-label">Company Contact Number <span className="text-destructive">*</span></Label>
                <Input disabled={isViewMode} value={contactNumber} onChange={e => setContactNumber(e.target.value)} placeholder="+91..." />
              </div>
              <div>
                <Label className="field-label">Contact Person Name</Label>
                <Input disabled={isViewMode} value={contactPersonName} onChange={e => setContactPersonName(e.target.value)} placeholder="John Doe" />
              </div>
              <div>
                <Label className="field-label">Contact Person Number</Label>
                <Input disabled={isViewMode} value={contactPersonNumber} onChange={e => setContactPersonNumber(e.target.value)} placeholder="+91..." />
              </div>
            </div>

            <div>
              <Label className="field-label">Address</Label>
              <Input disabled={isViewMode} value={address} onChange={e => setAddress(e.target.value)} placeholder="Full Address..." />
            </div>
          </div>

          <div className="card-elevated p-5 space-y-4">
            <h2 className="font-semibold uppercase text-xs tracking-wider text-muted-foreground mb-2">Lead Properties</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label className="field-label">Status</Label>
                <Select disabled={isViewMode} value={status} onValueChange={v => setStatus(v as LeadStatus)}>
                  <SelectTrigger className="capitalize">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_STATUSES.map(s => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="field-label">Intensity</Label>
                <Select disabled={isViewMode} value={intensity} onValueChange={v => setIntensity(v as LeadIntensity)}>
                  <SelectTrigger className="capitalize">
                    <SelectValue placeholder="Select intensity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cold">Cold</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="hot">Hot</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="sm:col-span-2 lg:col-span-1">
                <Label className="field-label">Lead Source</Label>
                <div className="flex gap-2">
                  <Select disabled={isViewMode} value={source} onValueChange={setSource}>
                    <SelectTrigger className="flex-1 capitalize">
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      {allSources.map(s => (
                        <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!isViewMode && (
                    <Button type="button" variant="outline" size="icon" onClick={() => setNewSourceOpen(true)}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="card-elevated p-5 space-y-4">
            <h2 className="font-semibold uppercase text-xs tracking-wider text-muted-foreground mb-2">Product Interest</h2>
            
            <div>
              <Label className="field-label flex items-center justify-between">
                <span>Interested Products</span>
                {!isViewMode && (
                  <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setProductPickerOpen(true)}>
                    <Plus className="w-3 h-3 mr-1" /> Select Products
                  </Button>
                )}
              </Label>
              
              {selectedProducts.length === 0 ? (
                <div className="p-4 bg-secondary/50 rounded-lg text-sm text-muted-foreground text-center border border-border border-dashed">
                  No products selected
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedProducts.map(id => {
                    const p = products.find(prod => prod.id === id);
                    return p ? (
                      <div key={id} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 rounded-lg text-sm font-medium">
                        {p.name}
                        {!isViewMode && (
                          <button type="button" onClick={() => toggleProduct(id)} className="hover:opacity-70">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </div>

            <div>
              <Label className="field-label">Quantity (kg) <span className="text-muted-foreground font-normal">- if order placed</span></Label>
              <Input disabled={isViewMode} type="number" min="1" value={quantity} onChange={e => setQuantity(Number(e.target.value) || "")} placeholder="0" />
            </div>
          </div>

          <div className="card-elevated p-5">
            <Label className="field-label">Notes</Label>
            <div className="relative">
              <textarea
                disabled={isViewMode}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional details or remarks..."
                rows={4}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring transition-colors pb-12 disabled:opacity-75 disabled:cursor-not-allowed bg-transparent"
              />
              {!isViewMode && (
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
              )}
            </div>
          </div>

          {!isViewMode && (
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => {
                if (existingLead) {
                  setIsViewMode(true);
                } else {
                  navigate("/leads");
                }
              }}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={!isValid}>
                {existingLead ? "Save Changes" : "Save Lead"}
              </Button>
            </div>
          )}
        </form>
      </div>

      {/* New Source Dialog */}
      <Dialog open={newSourceOpen} onOpenChange={setNewSourceOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Lead Source</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="field-label">Source Name</Label>
              <Input
                value={newSourceText}
                onChange={e => setNewSourceText(e.target.value)}
                placeholder="e.g. Google Ads"
                autoFocus
              />
            </div>
            <div className="flex gap-2 pt-2 border-t border-border">
              <Button variant="outline" className="flex-1" onClick={() => setNewSourceOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={handleAddSource} disabled={!newSourceText.trim()}>Add Source</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Picker Dialog */}
      <Dialog open={productPickerOpen} onOpenChange={setProductPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Select Interested Products</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input 
              placeholder="Search products..." 
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
            />
            <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-2">
              {filteredProducts.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">No products found.</p>
              ) : (
                filteredProducts.map(product => (
                  <label key={product.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-secondary cursor-pointer border border-transparent hover:border-border transition-colors">
                    <Checkbox
                      checked={selectedProducts.includes(product.id)}
                      onCheckedChange={() => toggleProduct(product.id)}
                    />
                    <span className="text-sm font-medium">{product.name}</span>
                  </label>
                ))
              )}
            </div>
            <div className="flex justify-end pt-2 border-t border-border">
              <Button onClick={() => setProductPickerOpen(false)}>Done</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
