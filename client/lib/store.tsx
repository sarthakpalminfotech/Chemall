import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  Product,
  Order,
  Employee,
  Supplier,
  InventoryItem,
  InventoryLog,
  Note,
  Alert,
  ProductType,
  OrderStatus,
  SupplierType,
  DispatchContainerItem,
} from "@/lib/types";
import { supabase } from "./supabase";

export const CURRENT_USER_ID = "00000000-0000-0000-0000-000000000001"; // Matches seeded owner

interface AppState {
  products: Product[];
  orders: Order[];
  employees: Employee[];
  suppliers: Supplier[];
  inventory: InventoryItem[];
  inventoryLogs: InventoryLog[];
  notes: Note[];
  alerts: Alert[];
  loading: boolean;
}

interface AppActions {
  // Products
  addProduct: (product: Omit<Product, "id" | "createdAt">) => Promise<Product>;
  updateProduct: (id: string, product: Omit<Product, "id" | "createdAt">) => Promise<Product>;
  deleteProduct: (id: string) => Promise<void>;

  // Orders
  addOrder: (order: Omit<Order, "id" | "createdAt" | "updatedAt">) => Promise<Order>;
  updateOrder: (id: string, updates: Partial<Order>) => Promise<void>;
  markInProduction: (
    orderId: string,
    dispatchContainers: DispatchContainerItem[],
    dispatchNote: string,
    qrDataUrl: string
  ) => Promise<{ batchNumber: string; stockWarnings: string[] }>;
  assignPriority: (orderId: string, priority: number | undefined) => Promise<void>;
  markAsDispatched: (orderId: string) => Promise<void>;

  // Employees
  addEmployee: (employee: Omit<Employee, "id" | "createdAt" | "updatedAt">) => Promise<Employee>;

  // Suppliers
  addSupplier: (supplier: Omit<Supplier, "id" | "createdAt" | "updatedAt">) => Promise<Supplier>;

  // Inventory
  addInventory: (items: { productId: string; quantity: number }[]) => Promise<void>;
  removeInventory: (productId: string, quantity: number, notes: string) => Promise<void>;

  // Notes
  addNote: (content: string) => Promise<Note>;
  updateNote: (id: string, content: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;

  // Alerts
  markAlertRead: (id: string) => Promise<void>;

  // Helpers
  getProductContainerTypes: (productIds: string[]) => Product[];
  getPreviousRate: (supplierId: string, productId: string) => number | null;
  isOwnerAdmin: () => boolean;
  refreshData: () => Promise<void>;
}

type AppStore = AppState & AppActions;

const AppContext = createContext<AppStore | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshData = async () => {
    try {
      // 2. Products
      const { data: prodData, error: prodErr } = await supabase
        .from("products")
        .select("*")
        .order("name", { ascending: true });
      if (prodErr) console.error(prodErr);

      const { data: pctData, error: pctErr } = await supabase
        .from("product_container_types")
        .select("*");
      if (pctErr) console.error(pctErr);

      const mappedProducts: Product[] = (prodData || []).map((p) => {
        const containers = (pctData || [])
          .filter((pct: any) => pct.product_id === p.id)
          .map((pct: any) => pct.container_type_id);
          
        return {
          id: p.id,
          name: p.name,
          type: p.type as ProductType,
          containerTypes: containers,
          alertThreshold: p.alert_threshold ? Number(p.alert_threshold) : 100,
          isContainer: p.is_container,
          capacity: p.capacity ? Number(p.capacity) : undefined,
          unit: p.unit || "kg",
          createdAt: new Date(p.created_at),
        };
      });
      setProducts(mappedProducts);

      // 3. Suppliers
      const { data: suppData } = await supabase
        .from("suppliers")
        .select("*")
        .order("name", { ascending: true });
      const mappedSuppliers: Supplier[] = (suppData || []).map((s) => ({
        id: s.id,
        name: s.name,
        address: s.address || "",
        contactNumber: s.contact_number || "",
        leadSource: s.lead_source || undefined,
        type: s.type as SupplierType,
        createdAt: new Date(s.created_at),
        updatedAt: new Date(s.updated_at),
      }));
      setSuppliers(mappedSuppliers);

      // 4. Employees
      const { data: empData } = await supabase
        .from("employees")
        .select("*, employee_permissions(*)");
      const mappedEmployees: Employee[] = (empData || []).map((e) => ({
        id: e.id,
        name: e.name,
        phoneNumber: e.phone_number,
        address: e.address || "",
        designation: e.designation,
        password: e.password_hash,
        createdAt: new Date(e.created_at),
        updatedAt: new Date(e.updated_at),
        moduleAccess: (e.employee_permissions || []).map((ep: any) => ({
          moduleName: ep.module_name,
          read: ep.can_read,
          write: ep.can_write,
        })),
      }));
      setEmployees(mappedEmployees);

      // 5. Inventory
      const { data: invData } = await supabase.from("inventory").select("*");
      const mappedInventory: InventoryItem[] = (invData || []).map((i) => ({
        id: i.id,
        productId: i.product_id,
        productName: i.product_name,
        productType: i.product_type as ProductType,
        quantity: Number(i.quantity),
        lastUpdated: new Date(i.last_updated),
      }));
      setInventory(mappedInventory);

      // 6. Inventory Logs
      const { data: logData } = await supabase
        .from("inventory_logs")
        .select("*")
        .order("created_at", { ascending: false });
      const mappedLogs: InventoryLog[] = (logData || []).map((l) => ({
        id: l.id,
        productId: l.product_id,
        productName: l.product_name,
        quantity: Number(l.quantity),
        type: l.type as "IN" | "OUT",
        reference: l.reference || undefined,
        date: new Date(l.created_at),
      }));
      setInventoryLogs(mappedLogs);

      // 7. Notes (scoped to current user)
      const { data: noteData } = await supabase
        .from("notes")
        .select("*")
        .eq("employee_id", CURRENT_USER_ID)
        .order("updated_at", { ascending: false });
      const mappedNotes: Note[] = (noteData || []).map((n) => ({
        id: n.id,
        content: n.content,
        createdAt: new Date(n.created_at),
        updatedAt: new Date(n.updated_at),
      }));
      setNotes(mappedNotes);

      // 8. Alerts
      const { data: alertData } = await supabase
        .from("alerts")
        .select("*")
        .order("created_at", { ascending: false });
      const mappedAlerts: Alert[] = (alertData || []).map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        message: a.message,
        read: a.is_read,
        timestamp: new Date(a.created_at),
        relatedOrderId: a.related_order_id || undefined,
        relatedProductId: a.related_product_id || undefined,
      }));
      setAlerts(mappedAlerts);

      // 9. Orders (fully joined)
      const { data: orderData } = await supabase.from("orders").select(`
        *,
        order_products(*),
        order_preferred_containers(container_type_id),
        order_dispatch_containers(product_id, container_type_id, quantity)
      `).order("created_at", { ascending: false });

      const mappedOrders: Order[] = (orderData || []).map((o: any) => ({
        id: o.id,
        batchNumber: o.batch_number || undefined,
        supplierId: o.supplier_id,
        supplierName: o.supplier_name,
        totalAmount: Number(o.total_amount),
        currency: o.currency,
        date: new Date(o.order_date),
        status: o.status as OrderStatus,
        priority: o.priority || undefined,
        notes: o.notes || undefined,
        dispatchNote: o.dispatch_note || undefined,
        qrDataUrl: o.qr_data_url || undefined,
        createdAt: new Date(o.created_at),
        updatedAt: new Date(o.updated_at),
        preferredContainers: o.order_preferred_containers?.map((pc: any) => pc.container_type_id) || [],
        dispatchContainers: o.order_dispatch_containers?.map((dc: any) => ({
          productId: dc.product_id,
          containerTypeId: dc.container_type_id,
          quantity: Number(dc.quantity),
        })) || [],
        repeatOrder: o.repeat_enabled
          ? {
              enabled: true,
              startDate: o.repeat_start_date ? new Date(o.repeat_start_date) : undefined,
              recurrenceType: o.recurrence_type,
              weekDays: o.recurrence_weekdays || undefined,
            }
          : undefined,
        products: (o.order_products || []).map((op: any) => ({
          productId: op.product_id,
          productName: op.product_name,
          quantity: Number(op.quantity),
          ratePerKg: Number(op.rate_per_kg),
          previousRate: op.previous_rate ? Number(op.previous_rate) : undefined,
        })),
      }));
      setOrders(mappedOrders);
    } catch (err) {
      console.error("Error loading Supabase data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // ── Products ────────────────────────────────────────────────────────────────
  const addProduct = async (data: Omit<Product, "id" | "createdAt">) => {
    const { data: newProd, error } = await supabase
      .from("products")
      .insert({
        name: data.name,
        type: data.type,
        alert_threshold: data.alertThreshold ?? 100.00,
        is_container: data.isContainer ?? false,
        capacity: data.capacity ?? null,
        unit: data.unit || "kg",
      })
      .select()
      .single();

    if (error) throw error;

    if (data.containerTypes && data.containerTypes.length > 0) {
      const relationInserts = data.containerTypes.map((ctId) => ({
        product_id: newProd.id,
        container_type_id: ctId,
      }));
      await supabase.from("product_container_types").insert(relationInserts);
    }

    await refreshData();
    return {
      id: newProd.id,
      name: newProd.name,
      type: newProd.type as ProductType,
      containerTypes: data.containerTypes || [],
      alertThreshold: Number(newProd.alert_threshold ?? 100),
      isContainer: newProd.is_container,
      capacity: newProd.capacity ? Number(newProd.capacity) : undefined,
      unit: newProd.unit || "kg",
      createdAt: new Date(newProd.created_at),
    };
  };

  const updateProduct = async (id: string, data: Omit<Product, "id" | "createdAt">) => {
    const { data: updatedProd, error } = await supabase
      .from("products")
      .update({
        name: data.name,
        type: data.type,
        alert_threshold: data.alertThreshold ?? 100.00,
        is_container: data.isContainer ?? false,
        capacity: data.capacity ?? null,
        unit: data.unit || "kg",
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Delete existing container relations
    await supabase.from("product_container_types").delete().eq("product_id", id);

    // Insert new container relations
    if (data.containerTypes && data.containerTypes.length > 0) {
      const relationInserts = data.containerTypes.map((ctId) => ({
        product_id: id,
        container_type_id: ctId,
      }));
      await supabase.from("product_container_types").insert(relationInserts);
    }

    await refreshData();
    return {
      id: updatedProd.id,
      name: updatedProd.name,
      type: updatedProd.type as ProductType,
      containerTypes: data.containerTypes || [],
      alertThreshold: Number(updatedProd.alert_threshold ?? 100),
      isContainer: updatedProd.is_container,
      capacity: updatedProd.capacity ? Number(updatedProd.capacity) : undefined,
      unit: updatedProd.unit || "kg",
      createdAt: new Date(updatedProd.created_at),
    };
  };

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw error;
    await refreshData();
  };



  // ── Orders ─────────────────────────────────────────────────────────────────
  const addOrder = async (data: Omit<Order, "id" | "createdAt" | "updatedAt">) => {
    const { data: newOrder, error: orderErr } = await supabase
      .from("orders")
      .insert({
        supplier_id: data.supplierId,
        supplier_name: data.supplierName,
        currency: data.currency,
        total_amount: data.totalAmount,
        order_date: data.date.toISOString().split("T")[0],
        status: data.status,
        priority: data.priority || null,
        notes: data.notes || null,
        repeat_enabled: data.repeatOrder?.enabled || false,
        repeat_start_date: data.repeatOrder?.startDate
          ? data.repeatOrder.startDate.toISOString().split("T")[0]
          : null,
        recurrence_type: data.repeatOrder?.recurrenceType || null,
        recurrence_weekdays: data.repeatOrder?.weekDays || null,
      })
      .select()
      .single();

    if (orderErr) throw orderErr;

    // Add order products
    const productInserts = data.products.map((p) => ({
      order_id: newOrder.id,
      product_id: p.productId,
      product_name: p.productName,
      quantity: p.quantity,
      rate_per_kg: p.ratePerKg,
      previous_rate: p.previousRate || null,
      currency: data.currency,
    }));
    const { error: prodErr } = await supabase.from("order_products").insert(productInserts);
    if (prodErr) throw prodErr;

    // Add preferred containers
    if (data.preferredContainers && data.preferredContainers.length > 0) {
      const containerInserts = data.preferredContainers.map((ctId) => ({
        order_id: newOrder.id,
        container_type_id: ctId,
      }));
      await supabase.from("order_preferred_containers").insert(containerInserts);
    }

    await refreshData();

    return {
      ...data,
      id: newOrder.id,
      createdAt: new Date(newOrder.created_at),
      updatedAt: new Date(newOrder.updated_at),
    };
  };

  const updateOrder = async (id: string, updates: Partial<Order>) => {
    const dbUpdates: any = {};
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.dispatchNote !== undefined) dbUpdates.dispatch_note = updates.dispatchNote;

    const { error } = await supabase.from("orders").update(dbUpdates).eq("id", id);
    if (error) throw error;
    await refreshData();
  };

  const markInProduction = async (
    orderId: string,
    dispatchContainers: DispatchContainerItem[],
    dispatchNote: string,
    qrDataUrl: string
  ) => {
    const dbContainers = dispatchContainers.map((item) => ({
      product_id: item.productId,
      container_type_id: item.containerTypeId,
      quantity: item.quantity,
    }));

    const { data: res, error } = await supabase.rpc("mark_in_production", {
      p_order_id: orderId,
      p_dispatch_containers_json: dbContainers,
      p_dispatch_note: dispatchNote,
      p_qr_data_url: qrDataUrl,
      p_employee_id: CURRENT_USER_ID,
    });

    if (error) throw error;

    await refreshData();
    return {
      batchNumber: res.batch_number,
      stockWarnings: res.warnings || [],
    };
  };

  const assignPriority = async (orderId: string, priority: number | undefined) => {
    const { error } = await supabase
      .from("orders")
      .update({ priority: priority || null })
      .eq("id", orderId);
    if (error) throw error;
    await refreshData();
  };

  const markAsDispatched = async (orderId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ status: "dispatched" })
      .eq("id", orderId);
    if (error) throw error;
    await refreshData();
  };

  // ── Employees ──────────────────────────────────────────────────────────────
  const addEmployee = async (data: Omit<Employee, "id" | "createdAt" | "updatedAt">) => {
    const { data: newEmp, error: empErr } = await supabase
      .from("employees")
      .insert({
        name: data.name,
        phone_number: data.phoneNumber,
        address: data.address,
        designation: data.designation,
        password_hash: data.password, // Frontend already hashed or formatted
      })
      .select()
      .single();

    if (empErr) throw empErr;

    if (data.moduleAccess && data.moduleAccess.length > 0) {
      const permissionInserts = data.moduleAccess.map((ma) => ({
        employee_id: newEmp.id,
        module_name: ma.moduleName,
        can_read: ma.read,
        can_write: ma.write,
      }));
      await supabase.from("employee_permissions").insert(permissionInserts);
    }

    await refreshData();
    return {
      ...data,
      id: newEmp.id,
      createdAt: new Date(newEmp.created_at),
      updatedAt: new Date(newEmp.updated_at),
    };
  };

  // ── Suppliers ──────────────────────────────────────────────────────────────
  const addSupplier = async (data: Omit<Supplier, "id" | "createdAt" | "updatedAt">) => {
    const { data: newSupp, error } = await supabase
      .from("suppliers")
      .insert({
        name: data.name,
        address: data.address,
        contact_number: data.contactNumber || null,
        lead_source: data.leadSource || null,
        type: data.type,
      })
      .select()
      .single();

    if (error) throw error;

    await refreshData();
    return {
      id: newSupp.id,
      name: newSupp.name,
      address: newSupp.address || "",
      contactNumber: newSupp.contact_number || "",
      leadSource: newSupp.lead_source || undefined,
      type: newSupp.type as SupplierType,
      createdAt: new Date(newSupp.created_at),
      updatedAt: new Date(newSupp.updated_at),
    };
  };

  // ── Inventory ──────────────────────────────────────────────────────────────
  const addInventory = async (items: { productId: string; quantity: number }[]) => {
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (!product) continue;

      // Check if product exists in inventory
      const existing = inventory.find((inv) => inv.productId === item.productId);

      if (existing) {
        const { error } = await supabase
          .from("inventory")
          .update({
            quantity: existing.quantity + item.quantity,
            last_updated: new Date().toISOString(),
          })
          .eq("product_id", item.productId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("inventory").insert({
          product_id: item.productId,
          product_name: product.name,
          product_type: product.type,
          quantity: item.quantity,
        });
        if (error) throw error;
      }

      // Add audit log
      const { error: logErr } = await supabase.from("inventory_logs").insert({
        product_id: item.productId,
        product_name: product.name,
        quantity: item.quantity,
        type: "IN",
      });
      if (logErr) throw logErr;
    }

    await refreshData();
  };

  const removeInventory = async (productId: string, quantity: number, notes: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) throw new Error("Product not found");

    const existing = inventory.find((inv) => inv.productId === productId);
    if (!existing || existing.quantity < quantity) {
      throw new Error("Insufficient inventory");
    }

    const { error } = await supabase
      .from("inventory")
      .update({
        quantity: existing.quantity - quantity,
        last_updated: new Date().toISOString(),
      })
      .eq("product_id", productId);
    if (error) throw error;

    const { error: logErr } = await supabase.from("inventory_logs").insert({
      product_id: productId,
      product_name: product.name,
      quantity: quantity,
      type: "OUT",
      reference: notes,
    });
    if (logErr) throw logErr;

    await refreshData();
  };

  // ── Notes ──────────────────────────────────────────────────────────────────
  const addNote = async (content: string) => {
    const { data: newNote, error } = await supabase
      .from("notes")
      .insert({
        employee_id: CURRENT_USER_ID,
        content,
      })
      .select()
      .single();

    if (error) throw error;
    await refreshData();

    return {
      id: newNote.id,
      content: newNote.content,
      createdAt: new Date(newNote.created_at),
      updatedAt: new Date(newNote.updated_at),
    };
  };

  const updateNote = async (id: string, content: string) => {
    const { error } = await supabase
      .from("notes")
      .update({ content })
      .eq("id", id);
    if (error) throw error;
    await refreshData();
  };

  const deleteNote = async (id: string) => {
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) throw error;
    await refreshData();
  };

  // ── Alerts ─────────────────────────────────────────────────────────────────
  const markAlertRead = async (id: string) => {
    const { error } = await supabase
      .from("alerts")
      .update({ is_read: true })
      .eq("id", id);
    if (error) throw error;
    await refreshData();
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getProductContainerTypes = (productIds: string[]) => {
    const ctIds = new Set(
      productIds.flatMap((pid) => {
        const product = products.find((p) => p.id === pid);
        return product?.containerTypes || [];
      })
    );
    return products.filter((p) => ctIds.has(p.id));
  };

  const getPreviousRate = (supplierId: string, productId: string) => {
    const previousOrders = orders
      .filter(
        (o) =>
          o.supplierId === supplierId &&
          o.products.some((p) => p.productId === productId)
      )
      .sort((a, b) => b.date.getTime() - a.date.getTime());

    if (previousOrders.length === 0) return null;

    const product = previousOrders[0].products.find((p) => p.productId === productId);
    return product?.ratePerKg ?? null;
  };

  const isOwnerAdmin = () => {
    const user = employees.find((e) => e.id === CURRENT_USER_ID);
    return user?.designation === "owner" || user?.designation === "admin";
  };

  const store: AppStore = {
    products,
    orders,
    employees,
    suppliers,
    inventory,
    inventoryLogs,
    notes,
    alerts,
    loading,
    addProduct,
    updateProduct,
    deleteProduct,
    addOrder,
    updateOrder,
    markInProduction,
    assignPriority,
    markAsDispatched,
    addEmployee,
    addSupplier,
    addInventory,
    removeInventory,
    addNote,
    updateNote,
    deleteNote,
    markAlertRead,
    getProductContainerTypes,
    getPreviousRate,
    isOwnerAdmin,
    refreshData,
  };

  return (
    <AppContext.Provider value={store}>
      {loading ? (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
            <p className="mt-4 text-sm text-muted-foreground">Loading database state...</p>
          </div>
        </div>
      ) : (
        children
      )}
    </AppContext.Provider>
  );
}

export function useStore(): AppStore {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useStore must be used within AppProvider");
  return ctx;
}
