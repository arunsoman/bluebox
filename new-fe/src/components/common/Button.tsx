import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantClass: Record<Variant, string> = {
  primary: styles.btnPrimary,
  secondary: styles.btnSecondary,
  ghost: styles.btnGhost,
  danger: styles.btnDanger,
};

const sizeClass: Record<Size, string> = {
  sm: styles.btnSm,
  md: styles.btnMd,
  lg: styles.btnLg,
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`${styles.btnBase} ${variantClass[variant]} ${sizeClass[size]}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className={styles.btnSpinner} aria-hidden /> : null}
      {children}
    </button>
  );
}
