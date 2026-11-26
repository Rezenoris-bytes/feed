"use client";
import { motion, useReducedMotion } from "framer-motion";
import { MessageSquareLock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme/theme";
import { BrandMark } from "@/components/shell/brand-mark";

export function AuthCard({ title, description, children, logo = null, company = "Feed" }: { title: string; description: string; children: React.ReactNode; logo?: string | null; company?: string }) {
  const reduce = useReducedMotion();
  return (
    <div className="relative grid min-h-dvh place-items-center bg-background px-4 py-10">
      <ThemeToggle className="absolute right-4 top-4" />
      <motion.div className="w-full max-w-sm" initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <BrandMark logo={logo} company={company} />
          <span className="text-xl font-semibold">{company}</span>
        </div>
        <Card>
          <CardHeader><CardTitle><h1 className="text-xl font-semibold">{title}</h1></CardTitle><CardDescription>{description}</CardDescription></CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Something went wrong");
  return data;
}
