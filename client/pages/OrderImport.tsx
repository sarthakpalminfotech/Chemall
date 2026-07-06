import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Sparkles, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";

export default function OrderImport() {
  const [rawText, setRawText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  
  const navigate = useNavigate();
  const { currentUser, isOwnerAdmin, suppliers, products } = useStore();

  const canWrite = isOwnerAdmin() || currentUser?.moduleAccess.find(m => m.moduleName === "Orders")?.write === true;
  if (!canWrite) return <Navigate to="/orders" replace />;

  const parseOrderText = (text: string) => {
    const t = text.toLowerCase();
    
    // 1. Find Supplier
    let matchedSupplier = suppliers.find(s => t.includes(s.name.toLowerCase()));
    
    // 2. Find Products
    const fg = products.filter(p => p.type === "finished_good");
    const matchedProducts = fg.filter(p => t.includes(p.name.toLowerCase()));
    
    // 3. Extract numbers that could be quantities or rates
    let defaultQty = 0;
    const qtyMatch = t.match(/(\d+(?:\.\d+)?)\s*(?:kg|kgs)/);
    if (qtyMatch) {
      defaultQty = parseInt(qtyMatch[1], 10);
    }
    
    let defaultRate = 0;
    let currency = "INR";
    const rateMatchINR = t.match(/(?:rs\.?|₹|inr)\s*(\d+(?:\.\d+)?)/) || t.match(/(\d+(?:\.\d+)?)\s*(?:rs\.?|inr|\/kg|\/ kg)/);
    const rateMatchUSD = t.match(/\$\s*(\d+(?:\.\d+)?)/) || t.match(/(\d+(?:\.\d+)?)\s*(?:usd)/);
    const rateMatchEUR = t.match(/€\s*(\d+(?:\.\d+)?)/) || t.match(/(\d+(?:\.\d+)?)\s*(?:eur)/);
    
    if (rateMatchINR) { defaultRate = parseFloat(rateMatchINR[1]); currency = "INR"; }
    else if (rateMatchUSD) { defaultRate = parseFloat(rateMatchUSD[1]); currency = "USD"; }
    else if (rateMatchEUR) { defaultRate = parseFloat(rateMatchEUR[1]); currency = "EUR"; }

    const parsedProducts = matchedProducts.map(p => ({
      productId: p.id,
      productName: p.name,
      quantity: defaultQty,
      ratePerKg: defaultRate
    }));

    return {
      supplierId: matchedSupplier?.id || "",
      products: parsedProducts,
      currency: currency,
      notes: "Imported from text:\n" + text,
    };
  };

  const handleGenerate = () => {
    if (rawText.trim()) {
      setIsParsing(true);
      
      // Simulate AI parsing delay
      setTimeout(() => {
        const parsed = parseOrderText(rawText);
        setIsParsing(false);
        navigate("/orders/manual", { state: { importedOrder: parsed } });
      }, 1200);
    }
  };

  return (
    <div className="w-full h-full">
      <div className="px-4 md:px-6 py-6">
        <Link to="/orders/new" className="inline-flex items-center gap-2 text-primary hover:opacity-80 transition-opacity mb-6 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2 tracking-tight">Import Order</h1>
          <p className="text-muted-foreground">Paste order details from WhatsApp, emails, or messages. Our system will extract the details automatically.</p>
        </div>

        <div className="max-w-3xl">
          <Card className="p-6 md:p-8 card-elevated">
            <label className="block mb-6">
              <span className="text-sm font-bold text-foreground block mb-3 uppercase tracking-wide">
                Raw Order Message
              </span>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Example: Received order from EcoPackaging Solutions for 500kg of Sulfuric Acid 98% at Rs 85.5/kg"
                rows={10}
                className="w-full p-4 bg-secondary/30 border border-border rounded-xl text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-y"
              />
            </label>

            <div className="flex items-center gap-3">
              <Link to="/orders/new" className="flex-1">
                <Button variant="outline" className="w-full h-11">
                  Cancel
                </Button>
              </Link>
              <Button
                className="flex-[2] h-11 gap-2"
                onClick={handleGenerate}
                disabled={!rawText.trim() || isParsing}
              >
                {isParsing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing Text...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Extract Details
                  </>
                )}
              </Button>
            </div>

            <div className="mt-6 p-4 bg-primary/5 border border-primary/10 rounded-lg">
              <p className="text-xs text-primary font-medium flex items-start gap-2 leading-relaxed">
                <span className="text-base leading-none">💡</span>
                <span>The smart parser detects Customer Names, Product Names, Quantities (kg), and Currencies (₹, $, €, Rs, /kg). You'll be able to review and edit all extracted details on the next screen before confirming.</span>
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
