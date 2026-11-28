import { AlignLeft, CheckSquare, CircleDot, Star, ToggleLeft, Type } from "lucide-react";
import type { FieldType } from "@/lib/customer-forms";

/** Shared by client and server components, so it lives outside the "use client" files. */
export const FIELD_ICON: Record<FieldType, typeof Type> = { short: Type, long: AlignLeft, rating: Star, yesno: ToggleLeft, choice: CircleDot, multi: CheckSquare };
