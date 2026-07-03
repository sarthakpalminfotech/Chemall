import { useState } from "react";
import { Scanner } from '@yudiel/react-qr-scanner';
import { useNavigate } from "react-router-dom";
import { useStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { QrCode, ArrowLeft } from "lucide-react";

export default function ScanQR() {
  const navigate = useNavigate();
  const { orders } = useStore();
  const { toast } = useToast();
  const [scanned, setScanned] = useState(false);

  const handleScan = (result: any) => {
    if (!result || scanned) return;
    
    // Support for both v1 and v2 API shapes
    let text = "";
    if (Array.isArray(result) && result.length > 0) {
      text = result[0].rawValue;
    } else if (result.text) {
      text = result.text;
    } else if (typeof result === "string") {
      text = result;
    }
    
    if (!text) return;

    setScanned(true);

    const order = orders.find(o => o.batchNumber === text);
    
    if (order) {
      toast({ title: "Order Found", description: `Redirecting to ${text}...` });
      navigate(`/orders/${order.id}`);
    } else {
      toast({ title: "Order Not Found", description: `No order found for QR: ${text}`, variant: "destructive" });
      setTimeout(() => setScanned(false), 2000);
    }
  };

  return (
    <div className="w-full flex flex-col h-[calc(100vh-64px)] overflow-hidden bg-background">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 flex items-center gap-3 border-b border-border bg-card shrink-0">
        <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <QrCode className="w-5 h-5 md:w-6 md:h-6 text-primary" />
            Scan Order QR
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">Scan an order batch QR code to view details</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-4 bg-secondary/20">
        <div className="w-full max-w-sm bg-card p-4 rounded-3xl shadow-sm border border-border">
          <div className="rounded-2xl overflow-hidden bg-black aspect-square relative">
            {!scanned ? (
              <Scanner
                onScan={handleScan}
                formats={["qr_code"]}
                components={{ tracker: true, audio: false }}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4 text-center">
                <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center mb-4">
                  <div className="w-6 h-6 rounded-full bg-success animate-pulse" />
                </div>
                <p className="font-semibold">Processing QR Code...</p>
              </div>
            )}
          </div>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Point your camera at the order QR code to scan.
          </p>
        </div>
      </div>
    </div>
  );
}
