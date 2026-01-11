"use client";

import { type HTMLAttributes, forwardRef } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "gradient" | "outline";
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = "", variant = "default", children, ...props }, ref) => {
    const variants = {
      default: "bg-white/5 border border-white/10",
      gradient:
        "bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20",
      outline: "border border-white/20 bg-transparent",
    };

    return (
      <div
        ref={ref}
        className={`rounded-xl p-6 ${variants[variant]} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = "Card";

export const CardHeader = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className = "", children, ...props }, ref) => (
  <div ref={ref} className={`mb-4 ${className}`} {...props}>
    {children}
  </div>
));

CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(({ className = "", children, ...props }, ref) => (
  <h3 ref={ref} className={`text-lg font-semibold text-white ${className}`} {...props}>
    {children}
  </h3>
));

CardTitle.displayName = "CardTitle";

export const CardContent = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(({ className = "", children, ...props }, ref) => (
  <div ref={ref} className={className} {...props}>
    {children}
  </div>
));

CardContent.displayName = "CardContent";
