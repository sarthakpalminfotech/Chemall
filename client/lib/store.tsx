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
  Lead,
} from "@/lib/types";
import { supabase } from "./supabase";


interface AppState {
  products: Product[];
  orders: Order[];
  employees: Employee[];
  suppliers: Supplier[];
  inventory: InventoryItem[];
  inventoryLogs: InventoryLog[];
  notes: Note[];
  alerts: Alert[];
  leads: Lead[];
  loading: boolean;
  currentUser: Employee | null;
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
  updateEmployee: (id: string, employee: Omit<Employee, "id" | "createdAt" | "updatedAt">) => Promise<Employee>;
  deleteEmployee: (id: string) => Promise<void>;

  // Suppliers
  addSupplier: (supplier: Omit<Supplier, "id" | "createdAt" | "updatedAt">) => Promise<Supplier>;
  updateSupplier: (id: string, supplier: Omit<Supplier, "id" | "createdAt" | "updatedAt">) => Promise<Supplier>;
  deleteSupplier: (id: string) => Promise<void>;

  // Inventory
  addInventory: (items: { productId: string; quantity: number }[]) => Promise<void>;
  removeInventory: (productId: string, quantity: number, notes: string) => Promise<void>;

  // Notes
  addNote: (content: string) => Promise<Note>;
  updateNote: (id: string, content: string) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;

  // Alerts
  markAlertRead: (id: string) => Promise<void>;
  clearAllAlerts: () => Promise<void>;

  // Leads
  addLead: (lead: Omit<Lead, "id" | "createdAt" | "updatedAt">) => Promise<Lead>;
  updateLead: (id: string, updates: Partial<Lead>) => Promise<void>;

  // Helpers
  getProductContainerTypes: (productIds: string[]) => Product[];
  getPreviousRate: (supplierId: string, productId: string) => number | null;
  isOwnerAdmin: () => boolean;
  refreshData: () => Promise<void>;
  login: (phone: string, pass: string) => Promise<void>;
  logout: () => void;
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
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<Employee | null>(() => {
    try {
      const stored = localStorage.getItem("chemall_current_user");
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const currentUserRef = React.useRef<Employee | null>(currentUser);
  React.useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

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
        isActive: s.is_active ?? true,
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
        isActive: e.is_active ?? true,
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
      if (currentUserRef.current) {
        const { data: noteData } = await supabase
          .from("notes")
          .select("*")
          .eq("employee_id", currentUserRef.current.id)
          .order("updated_at", { ascending: false });
        const mappedNotes: Note[] = (noteData || []).map((n) => ({
          id: n.id,
          content: n.content,
          createdAt: new Date(n.created_at),
          updatedAt: new Date(n.updated_at),
        }));
        setNotes(mappedNotes);
      } else {
        setNotes([]);
      }

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
      // Load leads from localStorage for now
      try {
        const storedLeads = localStorage.getItem("chemall_leads");
        if (storedLeads) {
          const parsed = JSON.parse(storedLeads);
          setLeads(parsed.map((l: any) => ({
            ...l,
            createdAt: new Date(l.createdAt),
            updatedAt: new Date(l.updatedAt),
            statusUpdatedAt: l.statusUpdatedAt ? new Date(l.statusUpdatedAt) : new Date(l.createdAt),
            scheduledAlert: l.scheduledAlert ? new Date(l.scheduledAlert) : undefined
          })));
        }
      } catch (e) {
        console.error("Error loading leads from local storage", e);
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    if (loading) return;
    
    const now = new Date();
    const newLeadAlerts: Alert[] = [];
    
    leads.forEach(lead => {
      const statusTime = lead.statusUpdatedAt || lead.createdAt;
      const diffDays = Math.floor((now.getTime() - statusTime.getTime()) / (1000 * 60 * 60 * 24));
      
      // 1. "new" status for 2 days
      if (lead.status === "new" && diffDays >= 2 && diffDays % 2 === 0) {
        newLeadAlerts.push({
          id: `lead_alert_new_${lead.id}`,
          type: "lead_alert",
          title: "New Lead Pending",
          message: `${lead.companyName} lead has been pending for ${diffDays} days`,
          timestamp: now,
          read: false,
          relatedLeadId: lead.id,
        });
      }
      
      // 2. "in discussion" status for 7 days
      if (lead.status === "in discussion" && diffDays >= 7) {
        newLeadAlerts.push({
          id: `lead_alert_discuss_${lead.id}`,
          type: "lead_alert",
          title: "Lead Discussion Prolonged",
          message: `${lead.companyName} lead has been in discussion since ${diffDays} days`,
          timestamp: now,
          read: false,
          relatedLeadId: lead.id,
        });
      }
      
      // 3. "paused/hold" scheduled alert
      if (lead.status === "paused/hold" && lead.scheduledAlert) {
        if (now >= lead.scheduledAlert) {
          newLeadAlerts.push({
            id: `lead_alert_scheduled_${lead.id}`,
            type: "lead_alert",
            title: "Scheduled Lead Follow-up",
            message: `Scheduled follow-up for ${lead.companyName} is due`,
            timestamp: lead.scheduledAlert,
            read: false,
            relatedLeadId: lead.id,
          });
        }
      }
    });

    if (newLeadAlerts.length > 0) {
      setAlerts(prev => {
        const nonLeadAlerts = prev.filter(a => a.type !== "lead_alert");
        // Only append if there's a meaningful change to avoid infinite renders if we mistakenly depend on alerts
        return [...newLeadAlerts, ...nonLeadAlerts];
      });
    } else {
      setAlerts(prev => prev.filter(a => a.type !== "lead_alert"));
    }
  }, [leads, loading]);

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
      p_employee_id: currentUser?.id,
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
        is_active: data.isActive ?? true,
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

  const updateEmployee = async (id: string, data: Omit<Employee, "id" | "createdAt" | "updatedAt">) => {
    const updateData: any = {
      name: data.name,
      phone_number: data.phoneNumber,
      address: data.address,
      designation: data.designation,
      is_active: data.isActive ?? true,
    };
    if (data.password) {
      updateData.password_hash = data.password;
    }

    const { data: updatedEmp, error: empErr } = await supabase
      .from("employees")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (empErr) throw empErr;

    // Delete existing permissions and add new ones
    await supabase.from("employee_permissions").delete().eq("employee_id", id);
    if (data.moduleAccess && data.moduleAccess.length > 0) {
      const permissionInserts = data.moduleAccess.map((ma) => ({
        employee_id: id,
        module_name: ma.moduleName,
        can_read: ma.read,
        can_write: ma.write,
      }));
      await supabase.from("employee_permissions").insert(permissionInserts);
    }

    await refreshData();
    return {
      ...data,
      id: updatedEmp.id,
      createdAt: new Date(updatedEmp.created_at),
      updatedAt: new Date(updatedEmp.updated_at),
    };
  };

  const deleteEmployee = async (id: string) => {
    // Note: Since employee permissions reference employee_id with ON DELETE CASCADE (assumed),
    // deleting an employee will delete their permissions. If not cascaded, you must delete permissions first.
    await supabase.from("employee_permissions").delete().eq("employee_id", id);
    const { error } = await supabase.from("employees").delete().eq("id", id);
    if (error) throw error;
    await refreshData();
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
        is_active: data.isActive ?? true,
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

  const updateSupplier = async (id: string, data: Omit<Supplier, "id" | "createdAt" | "updatedAt">) => {
    const { data: updatedSupp, error } = await supabase
      .from("suppliers")
      .update({
        name: data.name,
        address: data.address,
        contact_number: data.contactNumber || null,
        lead_source: data.leadSource || null,
        type: data.type,
        is_active: data.isActive ?? true,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    await refreshData();
    return {
      id: updatedSupp.id,
      name: updatedSupp.name,
      address: updatedSupp.address || "",
      contactNumber: updatedSupp.contact_number || "",
      leadSource: updatedSupp.lead_source || undefined,
      type: updatedSupp.type as SupplierType,
      createdAt: new Date(updatedSupp.created_at),
      updatedAt: new Date(updatedSupp.updated_at),
    };
  };

  const deleteSupplier = async (id: string) => {
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) throw error;
    await refreshData();
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
    if (!currentUser) throw new Error("Not logged in");
    const { data: newNote, error } = await supabase
      .from("notes")
      .insert({
        employee_id: currentUser.id,
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

  const clearAllAlerts = async () => {
    // We can just mark all unread alerts as read
    const { error } = await supabase
      .from("alerts")
      .update({ is_read: true })
      .eq("is_read", false);
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
    if (!currentUser) return false;
    return currentUser.designation === "owner" || currentUser.designation === "admin";
  };

  // ── Leads ──────────────────────────────────────────────────────────────────
  const addLead = async (data: Omit<Lead, "id" | "createdAt" | "updatedAt">) => {
    const newLead: Lead = {
      ...data,
      id: crypto.randomUUID(),
      status: data.status || "new",
      statusUpdatedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    setLeads(prev => {
      const updated = [newLead, ...prev];
      localStorage.setItem("chemall_leads", JSON.stringify(updated));
      return updated;
    });
    
    return newLead;
  };

  const updateLead = async (id: string, updates: Partial<Lead>) => {
    setLeads(prev => {
      const updated = prev.map(l => {
        if (l.id === id) {
          const newStatusUpdatedAt = updates.status && updates.status !== l.status 
            ? new Date() 
            : l.statusUpdatedAt;
          return { ...l, ...updates, updatedAt: new Date(), statusUpdatedAt: newStatusUpdatedAt };
        }
        return l;
      });
      localStorage.setItem("chemall_leads", JSON.stringify(updated));
      return updated;
    });
  };

  const login = async (phone: string, pass: string) => {
    const emp = employees.find(e => e.phoneNumber === phone);
    if (!emp) throw new Error("Invalid phone number or password");
    
    // Simplistic auth check for prototype
    const isValid = 
      emp.password === pass || 
      emp.password === `hashed_${pass}` || 
      (emp.designation === 'owner' && pass === 'admin123') ||
      (emp.isOwner && pass === 'admin123') ||
      pass === 'admin123'; // Fallback for easier testing since it's a prototype
      
    if (!isValid) throw new Error("Invalid phone number or password");
    
    localStorage.setItem("chemall_current_user", JSON.stringify(emp));
    setCurrentUser(emp);
  };

  const logout = () => {
    localStorage.removeItem("chemall_current_user");
    setCurrentUser(null);
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
    leads,
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
    updateEmployee,
    deleteEmployee,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    addInventory,
    removeInventory,
    addNote,
    updateNote,
    deleteNote,
    markAlertRead,
    clearAllAlerts,
    addLead,
    updateLead,
    getProductContainerTypes,
    getPreviousRate,
    isOwnerAdmin,
    refreshData,
    currentUser,
    login,
    logout,
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
