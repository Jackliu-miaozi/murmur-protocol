"use client";

import { type HTMLAttributes, forwardRef } from "react";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "info";
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className = "", variant = "default", children, ...props }, ref) => {
    const variants = {
      default: "bg-gray-500/20 text-gray-300",
      success: "bg-green-500/20 text-green-400",
      warning: "bg-yellow-500/20 text-yellow-400",
      danger: "bg-red-500/20 text-red-400",
      info: "bg-purple-500/20 text-purple-400",
    };

    return (
      <span
        ref={ref}
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant]} ${className}`}
        {...props}
      >
        {children}
      </span>
    );
  },
);

Badge.displayName = "Badge";
