export type UserRole = "company" | "employee";
export type EntityStatus = "active" | "inactive";
export type ShiftStatus = "open" | "closed";
export type DutyStatus = "on" | "off";
export type JobStatus = "open" | "completed" | "cancelled";

export interface Company {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface Profile {
  id: string;
  company_id: string;
  role: UserRole;
  employee_id: string | null;
  created_at: string;
}

export interface Employee {
  id: string;
  company_id: string;
  full_name: string;
  email: string;
  employee_code: string;
  phone: string | null;
  role_permission: string;
  status: EntityStatus;
}

export interface Worker {
  id: string;
  company_id: string;
  name: string;
  worker_code: string;
  status: EntityStatus;
}

export interface Supervisor {
  id: string;
  company_id: string;
  name: string;
  staff_code: string | null;
  status: EntityStatus;
}

export interface Machine {
  id: string;
  company_id: string;
  machine_number: string;
  name: string;
  status: EntityStatus;
}

export interface SheetOption {
  id: string;
  company_id: string;
  quantity: number;
  status: EntityStatus;
}

export interface ShiftTemplate {
  id: string;
  company_id: string;
  name: string;
  default_start_time: string | null;
  default_end_time: string | null;
  status: EntityStatus;
}

export interface Shift {
  id: string;
  company_id: string;
  name: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  original_start_time?: string | null;
  original_end_time?: string | null;
  supervisor_id: string | null;
  supervisor_name?: string | null;
  status: ShiftStatus;
  closed_at: string | null;
  machines?: Machine[];
  opened_at?: string | null;
}

export interface ShiftWorker {
  id: string;
  shift_id: string;
  worker_id: string;
  duty_status: DutyStatus;
  worker?: Worker;
}

export interface Job {
  id: string;
  company_id: string;
  shift_id: string;
  machine_id: string | null;
  job_number: string | null;
  job_name: string;
  total_sheets: number;
  dabbi: boolean;
  ups: number | null;
  status: JobStatus;
  allocated_sheets?: number;
  remaining_sheets?: number | null;
  break_sheets?: number;
  open_pile_count?: number;
  completed_pile_count?: number;
  machine?: Machine;
  shift?: Shift;
  shift_name?: string | null;
  shift_date?: string | null;
  machine_number?: string | null;
  machine_name?: string | null;
  created_at?: string | null;
}

export interface JobPile {
  id: string;
  job_id: string;
  worker_id: string;
  shift_id: string;
  sheets: number;
  is_custom: boolean;
  pile_in_at?: string | null;
  pile_out_at?: string | null;
  created_at: string;
  series_no?: number | null;
  worker_name?: string | null;
  total_seconds?: number | null;
  pile_date?: string | null;
  work_shift_name?: string | null;
  work_shift_date?: string | null;
  other_shift?: boolean;
  worker?: Worker;
}

export interface ApiErrorBody {
  code: string;
  message: string;
}

export interface ApiEnvelope<T> {
  data: T;
  error: ApiErrorBody | null;
  meta?: { total: number; page: number; page_size: number };
}

export interface CompanyDashboard {
  total_employees: number;
  total_accounts: number;
  total_machines: number;
  total_workers: number;
  active_shift: Shift | null;
  open_jobs: number;
  total_sheets: number;
  allocated_sheets: number;
  remaining_sheets: number;
  recent_activity: { id: string; summary: string; created_at: string }[];
  shift_worker_sheets: { worker_name: string; sheets: number }[];
  machine_ups_charts?: {
    machine_id: string;
    machine_number: string;
    machine_name: string;
    ups_values: number[];
    workers: {
      worker_id: string;
      worker_name: string;
      by_ups: Record<string, number>;
    }[];
  }[];
}

export interface EmployeeDashboard {
  current_shift: Shift | null;
  workers_on: number;
  workers_off: number;
  open_jobs: number;
  total_machines: number;
  total_sheets: number;
  allocated_sheets: number;
  remaining_sheets: number;
  previous_yellow_jobs?: {
    id: string;
    job_name: string;
    job_number: string;
    shift_name?: string | null;
    shift_date?: string | null;
    remaining_sheets?: number | null;
    machine_number?: string | null;
    machine_name?: string | null;
  }[];
  workers_pile_in?: {
    worker_id: string;
    worker_name: string;
    job_id: string;
    job_number: string;
    job_name: string;
    sheets: number;
    pile_in_at: string | null;
  }[];
  machine_charts?: {
    machine_id: string;
    machine_number: string;
    machine_name: string;
    points: { job_id: string; job_number: string; time: string | null; time_label: string }[];
  }[];
  job_sheet_bars?: {
    job_id: string;
    job_number: string;
    job_name: string;
    total_sheets: number;
    break_sheets: number;
  }[];
}
