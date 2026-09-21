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

export type LoginInput = z.infer<typeof loginSchema>;
