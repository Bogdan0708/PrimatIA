"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { rollbackImportBatchConfirmed } from "../../_actions/import-actions";

interface RollbackControlsProps {
  batchId: string;
  canRollback: boolean;
}

export function RollbackControls({ batchId, canRollback }: RollbackControlsProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const onRollback = () => {
    setMessage("");
    setError("");
    startTransition(async () => {
      const result = await rollbackImportBatchConfirmed(batchId, confirmed);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setMessage("Rollback finalizat");
      router.refresh();
    });
  };

  if (!canRollback) {
    return <p className="text-sm text-muted-foreground">Acest batch este deja anulat.</p>;
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        Confirm rollback pentru acest batch
      </label>
      <Button
        type="button"
        variant="destructive"
        disabled={!confirmed || isPending}
        onClick={onRollback}
      >
        {isPending ? "Se procesează..." : "Execută rollback"}
      </Button>
      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

