"use client";

export async function demoLogout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}
