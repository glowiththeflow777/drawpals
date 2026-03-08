export type UserRole = 'subcontractor' | 'admin';

export type InvoiceStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  crewName?: string;
}

export interface Project {
  id: string;
  name: string;
  address: string;
  totalBudget: number;
  amountInvoiced: number;
  amountPaid: number;
  status: 'active' | 'completed';
}

export interface BudgetLineItem {
  id: string;
  projectId: string;
  lineItemNo: number;
  costGroup: string;
  costItemName: string;
  description: string;
  quantity: number;
  unit: string;
  extendedCost: number;
  costType: string;
  costCode: string;
}

export interface InvoiceLineItem {
  id: string;
  lineItemNo?: number;
  description: string;
  contractPrice: number;
  percentComplete: number;
  drawAmount: number;
}

export interface DayLaborEntry {
  day: string;
  crewMembers: string;
  amount: number;
  hours?: number;
}

export interface ReimbursementEntry {
  date: string;
  store: string;
  description: string;
  amount: number;
}

export interface ChangeOrderEntry {
  quantity: number;
  description: string;
  amount: number;
}

export interface Invoice {
  id: string;
  projectId: string;
  crewName: string;
  projectAddress: string;
  payrollDrawDate: string;
  lineItems: InvoiceLineItem[];
  dayLabor: DayLaborEntry[];
  reimbursements: ReimbursementEntry[];
  changeOrders: ChangeOrderEntry[];
  credits: ChangeOrderEntry[];
  attachments: string[];
  status: InvoiceStatus;
  submittedAt?: string;
  submittedBy: string;
  rejectionNotes?: string;
  totals: {
    sowDraw: number;
    dayRateLabor: number;
    reimbursement: number;
    changeOrders: number;
    credits: number;
    total: number;
  };
}

export interface WizardStep {
  id: number;
  title: string;
  description: string;
  icon: string;
}
