import { z } from "zod";

const phoneRegex = /^03\d{9}$/;
const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;

export function normalizePhone(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("92") && digits.length === 12) {
    digits = `0${digits.slice(2)}`;
  }
  return digits;
}

export const loginSchema = z.object({
  phone: z
    .string()
    .transform(normalizePhone)
    .refine((v) => phoneRegex.test(v), "Enter a valid mobile number (03XXXXXXXXX)."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const accountFormSchema = z.object({
  phone: z
    .string()
    .transform(normalizePhone)
    .refine((v) => phoneRegex.test(v), "Enter a valid mobile number (03XXXXXXXXX)."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

export const staffEmployeeFormSchema = z
  .object({
    full_name: z.string().min(2).max(120),
    father_name: z.string().min(2).max(120),
    cnic: z
      .string()
      .refine((v) => cnicRegex.test(v.trim()), "CNIC format: 12345-1234567-1"),
    phone: z
      .string()
      .transform(normalizePhone)
      .refine((v) => phoneRegex.test(v), "Enter a valid mobile number (03XXXXXXXXX)."),
    position: z.enum(["Contract", "Salary"]),
    salary: z.coerce.number().int("Salary must be a whole number.").min(0, "Salary cannot be negative."),
    is_worker: z.boolean(),
    is_supervisor: z.boolean(),
    joining_date: z.string().min(1),
  })
  .refine((d) => d.is_worker || d.is_supervisor, {
    message: "Select Worker and/or Supervisor.",
    path: ["is_worker"],
  });

export const machineFormSchema = z.object({
  machine_number: z.string().min(1, "Machine number is required.").max(40),
  name: z.string().min(1, "Machine name is required.").max(80),
});

export const employeeFormSchema = z.object({
  full_name: z.string().min(2, "Full name must be at least 2 characters.").max(120),
  email: z.string().optional().default(""),
  employee_code: z.string().optional().default(""),
  phone: z.string().optional().nullable(),
  role_permission: z.string().optional().default("standard"),
});

export const companyRegisterSchema = z
  .object({
    company_name: z.string().min(2, "Company name must be at least 2 characters.").max(120),
    email: z.string().email("Enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match.",
    path: ["confirm_password"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type CompanyRegisterInput = z.infer<typeof companyRegisterSchema>;
