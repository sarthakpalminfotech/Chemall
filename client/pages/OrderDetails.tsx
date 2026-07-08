import { useParams, Link } from "react-router-dom";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Printer, QrCode, Edit2 } from "lucide-react";
import { formatDate } from "date-fns";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { useRef } from "react";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: string }) {
  if (status === "dispatched")
    return <span className="badge bg-slate-100 text-slate-700 border-slate-200 shadow-sm border px-2 py-0.5 rounded-md flex items-center gap-1.5 text-xs font-semibold w-fit"><span className="w-1.5 h-1.5 rounded-full bg-slate-500" />Dispatched</span>;
  if (status === "in_production")
    return <span className="badge badge-in-production w-fit"><span className="w-1.5 h-1.5 rounded-full bg-success" />In Production</span>;
  return <span className="badge badge-pending w-fit"><span className="w-1.5 h-1.5 rounded-full bg-warning" />Pending</span>;
}

export default function OrderDetails() {
  const { id } = useParams();
  const { currentUser, isOwnerAdmin, orders, products } = useStore();
  const canWrite = isOwnerAdmin() || currentUser?.moduleAccess.find(m => m.moduleName === "Orders")?.write === true;
  const qrRef = useRef<HTMLCanvasElement>(null);
  const order = orders.find(o => o.id === id);

  if (!order) {
    return (
      <div className="w-full h-full flex items-center justify-center py-24">
        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground mb-2">Order Not Found</h1>
          <Link to="/orders" className="text-primary hover:underline text-sm">← Back to Orders</Link>
        </div>
      </div>
    );
  }

  const getContainerName = (ctId: string) => products.find(c => c.id === ctId)?.name ?? ctId;

  const downloadQR = () => {
    if (!qrRef.current) return;
    const url = qrRef.current.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${order.batchNumber ?? "qr"}.png`;
    a.click();
  };

  const printQR = () => {
    if (!qrRef.current) return;
    const url = qrRef.current.toDataURL("image/png");
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><body style="text-align:center;padding:24px;font-family:monospace"><img src="${url}" width="200" /><p style="margin-top:12px;font-size:14px">${order.batchNumber}</p></body></html>`);
    win.document.close();
    win.print();
  };

  const currencySymbol = order.currency === "INR" ? "₹" : order.currency === "USD" ? "$" : "€";

  return (
    <div className="w-full">
      <div className="px-4 md:px-6 py-6 max-w-5xl mx-auto">
        {/* Header */}
        <Link to="/orders" className="inline-flex items-center gap-2 text-primary hover:opacity-75 transition-opacity mb-6 text-sm font-medium print:hidden">
          <ArrowLeft className="w-4 h-4" /> Back to Orders
        </Link>

        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Order Details</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {order.batchNumber ?? (order.status === "pending" ? "Pending Order" : `Order #${order.id}`)}
            </p>
          </div>
          <div className="flex items-center gap-3 print:hidden">
            <StatusBadge status={order.status} />
            <Link to={`/orders/new/manual?edit=${order.id}`}>
              <Button variant="outline" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <Edit2 className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* ── Left Column ── */}
          <div className="lg:col-span-2 space-y-3">
            {/* Main Order Info */}
            <div className="card-elevated p-4 md:p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="font-bold text-foreground text-lg">{order.supplierName}</p>
                <div className="bg-secondary/40 text-muted-foreground px-2.5 py-1 rounded-md text-xs font-medium">
                  {formatDate(new Date(order.date), "dd MMM yyyy")}
                </div>
              </div>

              <div className="space-y-3">
                {order.products.map(p => (
                  <div key={p.productId} className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-lg bg-secondary/10 border border-border/40 gap-3 sm:gap-0">
                    <div>
                      <p className="font-semibold text-sm text-foreground">{p.productName}</p>
                      {p.previousRate && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Prev rate: {currencySymbol}{p.previousRate}/kg
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground shrink-0 bg-background/50 sm:bg-transparent p-2 sm:p-0 rounded-md">
                      <span className="font-medium">{p.quantity.toLocaleString()} kg</span>
                      <span className="text-border/80">×</span>
                      <span className="font-medium">{currencySymbol}{p.ratePerKg}/kg</span>
                      <span className="text-border/80">=</span>
                      <span className="font-bold text-foreground">
                        {currencySymbol}{(p.quantity * p.ratePerKg).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="card-elevated p-5">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Notes</h3>
                <p className="text-sm text-foreground leading-relaxed">{order.notes}</p>
              </div>
            )}

            {/* In Production Details */}
            {(order.status === "in_production" || order.status === "dispatched") && (
              <>
                <div className="card-elevated p-5">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Production Information</h3>
                  <div className="space-y-3 text-sm">
                    {order.batchNumber && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Batch Number</p>
                        <p className="font-mono font-bold text-foreground text-base bg-secondary px-3 py-2 rounded-lg inline-block">{order.batchNumber}</p>
                      </div>
                    )}
                    {order.dispatchContainers && order.dispatchContainers.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1.5">Dispatch Containers</p>
                        <div className="space-y-2">
                          {order.dispatchContainers.map((item, idx) => {
                            const containerName = getContainerName(item.containerTypeId);
                            const prodName = order.products.find(p => p.productId === item.productId)?.productName || "Product";
                            return (
                              <div key={idx} className="flex items-center justify-between bg-secondary/30 px-3 py-1.5 rounded-lg text-xs">
                                <span><span className="font-medium text-foreground">{containerName}</span> for {prodName}</span>
                                <span className="font-mono bg-secondary px-2 py-0.5 rounded font-bold">Qty: {item.quantity}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {order.dispatchNote && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Dispatch Note</p>
                        <p className="text-foreground">{order.dispatchNote}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* QR Code */}
                {order.batchNumber && (
                  <div className="card-elevated p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <QrCode className="w-4 h-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">QR Code</h3>
                    </div>
                    <div className="flex flex-col items-center gap-4 p-6 bg-white border border-border rounded-xl">
                      <QRCodeSVG value={order.batchNumber} size={160} level="H" includeMargin />
                      <QRCodeCanvas ref={qrRef} value={order.batchNumber} size={400} level="H" includeMargin style={{ display: "none" }} />
                      <p className="text-xs font-mono text-muted-foreground">{order.batchNumber}</p>
                      <div className="flex gap-2 w-full max-w-xs print:hidden">
                        <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={downloadQR}>
                          <Download className="w-3.5 h-3.5" /> Download
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={printQR}>
                          <Printer className="w-3.5 h-3.5" /> Print
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Right Column: Summary ── */}
          <div>
            <div className="card-elevated p-5 sticky top-20">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Summary</h3>

              <div className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground">Order Amount</p>
                  <p className="text-3xl font-bold text-foreground mt-1">
                    {currencySymbol}{order.totalAmount.toLocaleString()}
                  </p>
                </div>

                <div className="border-t border-border pt-4 space-y-2">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Line Items</p>
                  {order.products.map(p => (
                    <div key={p.productId} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground truncate mr-2">{p.quantity} kg × {currencySymbol}{p.ratePerKg}</span>
                      <span className="font-medium text-foreground flex-shrink-0">{currencySymbol}{(p.quantity * p.ratePerKg).toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                {order.preferredContainers && order.preferredContainers.length > 0 && (
                  <div className="border-t border-border pt-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Preferred Containers</p>
                    <div className="flex flex-wrap gap-1">
                      {order.preferredContainers.map(ctId => (
                        <span key={ctId} className="text-xs px-2 py-0.5 bg-secondary rounded-md">{getContainerName(ctId)}</span>
                      ))}
                    </div>
                  </div>
                )}

                {order.repeatOrder?.enabled && (
                  <div className="border-t border-border pt-4">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Repeat Order</p>
                    <p className="text-sm font-semibold">{order.repeatOrder.recurrenceType === "monthly" ? "Every Month" : "Every Week"}</p>
                    {order.repeatOrder.startDate && (
                      <p className="text-xs text-muted-foreground mt-0.5">Starting {formatDate(new Date(order.repeatOrder.startDate), "dd MMM yyyy")}</p>
                    )}
                  </div>
                )}

                {canWrite && order.status === "pending" && (
                  <div className="border-t border-border pt-4 space-y-2 print:hidden">
                    <Link to={`/orders?markInProduction=${order.id}`}>
                      <Button className="w-full">Mark in Production</Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
