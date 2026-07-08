// Product Types
export type ProductType = "finished_good" | "raw_material";

export interface Product {
  id: string;
  name: string;
  type: ProductType;
  containerTypes?: string[]; // For finished goods
  alertThreshold?: number; // threshold in kg, default 100
  isContainer?: boolean; // if true, this raw material is a container
  capacity?: number; // capacity in kg if isContainer
  unit?: string; // e.g., kg, L, pcs
  createdAt: Date;
}

// Lead Types
export type LeadSource = "mail" | "website" | "direct contact" | "agent" | "social media" | string;
export type LeadIntensity = "cold" | "moderate" | "hot";
export type LeadStatus = "new" | "in discussion" | "paused/hold" | "won" | "lost" | "disqualified";

export interface Lead {
  id: string;
  companyName: string;
  contactNumber: string;
  contactPersonName?: string;
  contactPersonNumber?: string;
  address?: string;
  source: LeadSource;
  intensity: LeadIntensity;
  status: LeadStatus;
  statusReason?: string;
  products: string[]; // array of product IDs
  quantity?: number; // kg
  notes?: string;
  statusUpdatedAt?: Date;
  scheduledAlert?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Order Types
export type OrderStatus = "pending" | "in_production" | "dispatched";

export interface Order {
  id: string;
  batchNumber?: string;
  supplierId: string;
  supplierName: string;
  products: OrderProduct[];
  totalAmount: number;
  currency: "INR" | "USD" | "EUR";
  date: Date;
  status: OrderStatus;
  priority?: number; // 1-10, admin only
  notes?: string;
  repeatOrder?: RepeatOrderConfig;
  preferredContainers?: string[];
  dispatchContainers?: DispatchContainerItem[];
  dispatchNote?: string;
  qrDataUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderProduct {
  productId: string;
  productName: string;
  quantity: number; // kg, whole numbers
  ratePerKg: number;
  previousRate?: number;
}

export interface RepeatOrderConfig {
  enabled: boolean;
  startDate?: Date;
  recurrenceType?: "monthly" | "weekly";
  weekDays?: number[]; // 0-6 for Mon-Sun, only if weekly
}

// Employee Types
export type EmployeeDesignation = "owner" | "salesperson" | "worker" | "admin" | string;

export interface ModuleAccess {
  moduleName: string;
  read: boolean;
  write: boolean;
}

export interface Employee {
  id: string;
  name: string;
  phoneNumber: string;
  address: string;
  designation: EmployeeDesignation;
  moduleAccess: ModuleAccess[];
  password: string; // Hashed in real app
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Supplier/Customer Types
export type SupplierType = "customer" | "agent" | "raw_material_supplier" | string;

export interface Supplier {
  id: string;
  name: string;
  address: string;
  contactNumber: string;
  leadSource?: string;
  type: SupplierType;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Inventory Types
export interface InventoryItem {
  id: string;
  productId: string;
  productName: string;
  productType: ProductType;
  quantity: number; // kg
  lastUpdated: Date;
}

export interface InventoryLog {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  type: "IN" | "OUT";
  reference?: string; // Order batch number for OUT
  date: Date;
}

// Note Types
export interface Note {
  id: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

// Alert Types
export type AlertType =
  | "low_stock"
  | "order_unattended"
  | "no_dispatch"
  | "priority_unattended"
  | "repeat_customer_order"
  | "lead_alert"
  | "other";

export interface Alert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  relatedOrderId?: string;
  relatedProductId?: string;
  relatedLeadId?: string;
}

// KPI Types
export interface KPIData {
  label: string;
  value: number | string;
  trend?: "up" | "down";
  trendValue?: number;
}

// Dispatch Chart Data
export interface DispatchDataPoint {
  label: string;
  value: number;
}

export interface DispatchContainerItem {
  productId: string;
  containerTypeId: string;
  quantity: number;
}

// System Logs Types
export interface SystemLog {
  id: string;
  employeeId?: string;
  employeeName: string;
  action: string;
  module: string;
  createdAt: Date;
}
