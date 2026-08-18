export type User = {
  id: string;
  email: string;
  name: string;
  phone?: string;
  isOwner?: boolean;
  isTenant?: boolean;
};

export type Tab = "inicio" | "facturas" | "reclamos" | "avisos" | "mas";

export type PropertyOption = {
  id: string;
  label: string;
  buildingId: string;
  buildingName: string;
  address: string;
  role: "owner" | "tenant";
};

export type Building = {
  id: string;
  name: string;
  address: string;
  city: string;
  notes: string;
  ownerId?: string;
  owner?: { id: string; name: string; email: string; phone?: string };
  properties: Property[];
};

export type Property = {
  id: string;
  buildingId: string;
  label: string;
  floor: string;
  notes: string;
  billSplitMode: "tenant_pays_all" | "split_by_percentage";
  building?: Building;
  tenancies?: Tenancy[];
  contracts?: Contract[];
  rentChanges?: RentChange[];
  emergencyContacts?: EmergencyContact[];
  billingPeriods?: BillingPeriod[];
  claims?: Claim[];
  role?: "owner" | "tenant";
  /** Porcentaje que le toca a quien consulta (100 para el dueño). */
  myShare?: number;
};

export type Tenancy = {
  id: string;
  propertyId: string;
  tenantId: string;
  sharePercentage: number;
  active: boolean;
  tenant?: { id: string; name: string; email: string; phone?: string };
  property?: Property;
};

export type Contract = {
  id: string;
  rentAmount: number;
  currency: string;
  increaseEveryMonths: number;
  nextIncreaseDate: string | null;
  increaseMethod?: string;
  increaseNote: string;
  /** % estimado del próximo aumento (fijo o calculado por IPC en el backend). */
  estimatedIncreasePct?: number | null;
  estimatedRent?: number | null;
  estimateProjected?: boolean;
  estimateSource?: string | null;
  /** La fecha de aumento ya llegó o pasó. */
  increaseDue?: boolean;
  /** JSON string o array parseado de tipos obligatorios, ej. ["Luz","Gas"] */
  requiredInvoiceTypes?: string | string[];
  filePath: string | null;
  fileName: string | null;
  startDate: string;
  endDate: string | null;
  active: boolean;
};

export type RentChange = {
  id: string;
  previousAmount: number | null;
  newAmount: number;
  increasePct: number | null;
  kind: "initial" | "applied" | "manual" | string;
  method: string;
  note: string;
  effectiveDate: string;
  createdAt: string;
};

export type EmergencyContact = {
  id: string;
  category: string;
  name: string;
  phone: string;
  notes: string;
};

export type BillingPeriod = {
  id: string;
  propertyId: string;
  label: string;
  year: number;
  month: number;
  /** Alquiler congelado del mes; null en períodos viejos sin snapshot. */
  rentAmount: number | null;
  status: "collecting" | "ready" | "settled";
  readyAt: string | null;
  invoices?: Invoice[];
  payments?: Payment[];
};

export type Invoice = {
  id: string;
  type: string;
  amount: number;
  filePath: string | null;
  fileName: string | null;
  notes: string;
};

export type Payment = {
  id: string;
  amount: number;
  proofPath: string | null;
  proofName: string | null;
  status: "pending" | "approved" | "rejected";
  reviewNote: string;
  createdAt: string;
  tenant?: { id: string; name: string; email: string; phone?: string };
};

export type Claim = {
  id: string;
  title: string;
  description: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  photoPath: string | null;
  response: string;
  assignedTo: string;
  author?: { id: string; name: string; email: string; phone?: string };
  createdAt: string;
};

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  dataJson: string;
  readAt: string | null;
  createdAt: string;
};
