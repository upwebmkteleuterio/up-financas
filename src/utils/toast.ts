import { toast } from "sonner";
import type { ReactNode } from "react";

export const showSuccess = (message: string, description?: ReactNode) => {
  toast.success(message, description ? { description } : undefined);
};

export const showError = (message: string) => {
  toast.error(message);
};

export const showLoading = (message: string) => {
  return toast.loading(message);
};

export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};
