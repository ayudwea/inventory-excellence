import Swal from "sweetalert2";
import "./miraConfirm.css";

/**
 * Shared MIRA confirmation dialog.
 * Matches the existing "Pengajuan Berhasil Disimpan" modal.
 * Keeps SweetAlert2's keyboard and focus management.
 */
export async function showMiraConfirm({
  title,
  text,
  confirmText = "Ya, Lanjutkan",
  cancelText = "Batal",
  variant = "confirm",
}) {
  const result = await Swal.fire({
    icon: "question",
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    buttonsStyling: false,
    reverseButtons: true,
    showClass: { popup: "mira-confirm-enter" },
    hideClass: { popup: "mira-confirm-leave" },
    customClass: {
      container: "mira-confirm-container",
      popup: "mira-confirm-popup",
      icon: "mira-confirm-icon",
      title: "mira-confirm-title",
      htmlContainer: "mira-confirm-text",
      actions: "mira-confirm-actions",
      confirmButton: variant === "danger" ? "mira-confirm-primary mira-confirm-danger" : "mira-confirm-primary",
      cancelButton: "mira-confirm-secondary",
    },
  });
  return result.isConfirmed;
}
