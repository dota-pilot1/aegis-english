"use client";

import { useCallback, useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
};

type PendingState = ConfirmOptions & { resolve: (result: boolean) => void };

/**
 * window.confirm 대체용 훅. `await confirm({ title, ... })`가 boolean 을 반환한다.
 * 반환된 confirmDialog 엘리먼트를 컴포넌트 JSX 어딘가에 렌더링해야 한다.
 */
export function useConfirm() {
  const [pending, setPending] = useState<PendingState | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const close = useCallback(
    (result: boolean) => {
      setPending((cur) => {
        cur?.resolve(result);
        return null;
      });
    },
    [],
  );

  const confirmDialog = (
    <ConfirmDialog
      open={pending !== null}
      title={pending?.title ?? ""}
      description={pending?.description}
      confirmText={pending?.confirmText}
      cancelText={pending?.cancelText}
      variant={pending?.variant}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );

  return { confirm, confirmDialog };
}
