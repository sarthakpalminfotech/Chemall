import { Link, Navigate } from "react-router-dom";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, PlusCircle, Download } from "lucide-react";

export default function OrderNew() {
  const { currentUser, isOwnerAdmin } = useStore();
  const canWrite = isOwnerAdmin() || currentUser?.moduleAccess.find(m => m.moduleName === "Orders")?.write === true;
  
  if (!canWrite) return <Navigate to="/orders" replace />;

  return (
    <div className="w-full h-full">
      <div className="px-4 md:px-6 py-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Create New Order</h1>
            <p className="text-muted-foreground mt-1">Choose how you'd like to add a new order</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl">
          {/* Manual Add */}
          <Link to="/orders/new/manual">
            <Card className="p-6 flex flex-col items-center text-center h-full hover:border-primary/50 transition-colors cursor-pointer border-primary/30 bg-primary/5">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                <PlusCircle className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Manual Add</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Fill in order details manually
              </p>
              <Button size="sm">Get Started</Button>
            </Card>
          </Link>

          {/* Intake from Lead */}
          <Card className="p-6 flex flex-col items-center text-center opacity-50 cursor-not-allowed border-border/50">
            <div className="w-12 h-12 bg-secondary rounded-lg flex items-center justify-center mb-4">
              <Download className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Intake from Lead</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Convert a lead into an order
            </p>
            <span className="px-3 py-1 bg-secondary text-muted-foreground text-xs font-medium rounded-full">
              Coming Soon
            </span>
          </Card>
        </div>
      </div>
    </div>
  );
}
