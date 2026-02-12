"use client";

import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { toggleScutireRegula } from "../_actions/scutire-actions";

export function ToggleScutire({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter();

  const handleToggle = async () => {
    await toggleScutireRegula(id);
    router.refresh();
  };

  return <Switch checked={isActive} onCheckedChange={handleToggle} />;
}
