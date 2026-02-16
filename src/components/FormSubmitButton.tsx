"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

interface FormSubmitButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  pendingLabel?: ReactNode;
}

export function FormSubmitButton({
  children,
  pendingLabel,
  disabled,
  className,
  ...rest
}: FormSubmitButtonProps): JSX.Element {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <button {...rest} className={className} disabled={isDisabled} aria-busy={pending ? "true" : "false"}>
      {pending ? (
        <>
          <span className="btn-spinner" aria-hidden="true" />
          <span>{pendingLabel ?? children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

