import { apiRequest, withQuery } from "@/lib/api/client";
import type {
  Company,
  CompanyDashboard,
  CompanyRegisterInput,
  Employee,
  EmployeeDashboard,
  Job,
  JobPile,
  LoginInput,
  Machine,
  Profile,
  SheetOption,
  Shift,
  ShiftWorker,
  Supervisor,
  Worker,
} from "@/types/api-forms";

export type AuthSessionPayload = {
  profile: Profile;
  session: { access_token: string; refresh_token: string };
};

export async function registerCompany(
  body: CompanyRegisterInput,
): Promise<{ company: Company; session: AuthSessionPayload["session"] }> {
  return apiRequest("/auth/register/company", { method: "POST", body });
}

export async function login(body: LoginInput): Promise<AuthSessionPayload> {
  return apiRequest("/auth/login", { method: "POST", body });
}

export async function logout(token: string): Promise<null> {
  return apiRequest("/auth/logout", { method: "POST", token });
}

export async function getCompanyMe(token: string): Promise<Company> {
  return apiRequest("/companies/me", { token });
}

export async function getCompanyDashboard(token: string): Promise<CompanyDashboard> {
  return apiRequest("/dashboard/company", { token });
}

export async function getEmployeeDashboard(token: string): Promise<EmployeeDashboard> {
  return apiRequest("/dashboard/employee", { token });
}

export async function listEmployees(
  token: string,
  params: { status?: string; search?: string; page?: number } = {},
): Promise<Employee[]> {
  return apiRequest(withQuery("/employees", params), { token });
}

export async function listWorkers(
  token: string,
  params: { status?: string; search?: string } = {},
): Promise<Worker[]> {
  return apiRequest(withQuery("/workers", params), { token });
}

export async function listSupervisors(
  token: string,
  params: { status?: string } = {},
): Promise<Supervisor[]> {
  return apiRequest(withQuery("/supervisors", params), { token });
}

export async function listMachines(
  token: string,
  params: { status?: string } = {},
): Promise<Machine[]> {
  return apiRequest(withQuery("/machines", params), { token });
}

export async function listSheetOptions(
  token: string,
  params: { status?: string } = {},
): Promise<SheetOption[]> {
  return apiRequest(withQuery("/sheet-options", params), { token });
}

export async function getCurrentShift(token: string): Promise<Shift | null> {
  return apiRequest("/shifts/current", { token });
}

export async function listShifts(
  token: string,
  params: { status?: string; page?: number } = {},
): Promise<Shift[]> {
  return apiRequest(withQuery("/shifts", params), { token });
}

export async function createShift(
  token: string,
  body: Record<string, unknown>,
): Promise<Shift> {
  return apiRequest("/shifts", { method: "POST", token, body });
}

export async function closeShift(token: string, id: string): Promise<Shift> {
  return apiRequest(`/shifts/${id}/close`, { method: "POST", token });
}

export async function getShiftWorkers(
  token: string,
  shiftId: string,
): Promise<ShiftWorker[]> {
  return apiRequest(`/shifts/${shiftId}/workers`, { token });
}

export async function saveShiftWorkers(
  token: string,
  shiftId: string,
  workers: { worker_id: string; duty_status: "on" | "off" }[],
): Promise<ShiftWorker[]> {
  return apiRequest(`/shifts/${shiftId}/workers`, {
    method: "POST",
    token,
    body: { workers },
  });
}

export async function listJobs(
  token: string,
  params: Record<string, string | number | undefined> = {},
): Promise<Job[]> {
  return apiRequest(withQuery("/jobs", params), { token });
}

export async function getJob(token: string, id: string): Promise<Job> {
  return apiRequest(`/jobs/${id}`, { token });
}

export async function createJob(
  token: string,
  body: Record<string, unknown>,
): Promise<Job> {
  return apiRequest("/jobs", { method: "POST", token, body });
}

export async function listJobPiles(
  token: string,
  jobId: string,
  workerId?: string,
): Promise<JobPile[]> {
  return apiRequest(withQuery(`/jobs/${jobId}/piles`, { worker_id: workerId }), {
    token,
  });
}

export async function createPile(
  token: string,
  jobId: string,
  workerId: string,
  body: { sheets: number; is_custom: boolean; sheet_option_id?: string | null },
): Promise<{
  pile: JobPile;
  job_allocated_sheets: number;
  job_remaining_sheets: number;
}> {
  return apiRequest(`/jobs/${jobId}/workers/${workerId}/piles`, {
    method: "POST",
    token,
    body,
  });
}
