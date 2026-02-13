"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

type DeleteAction = (id: string) => Promise<{ success: boolean; error?: string }>;

interface ConfirmDeleteButtonProps {
  id: string;
  onDelete: DeleteAction;
  triggerLabel?: string;
  disabled?: boolean;
}

export function ConfirmDeleteButton({
  id,
  onDelete,
  triggerLabel,
  disabled,
}: ConfirmDeleteButtonProps) {
  const t = useTranslations("common");
  const { toast } = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      const result = await onDelete(id);
      if (result?.success) {
        toast({ title: t("success"), description: t("deleteSuccess") });
        setOpen(false);
        router.refresh();
        return;
      }
      toast({
        title: t("error"),
        description: result?.error ?? t("deleteError"),
        variant: "destructive",
      });
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
        >
          {triggerLabel ?? t("delete")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("deleteConfirmTitle")}</DialogTitle>
          <DialogDescription>{t("deleteConfirmDescription")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            {t("cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? t("loading") : t("delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
