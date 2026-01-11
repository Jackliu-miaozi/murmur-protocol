"use client";

import { type InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-2 block text-sm font-medium text-gray-300">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-white placeholder-gray-500 transition-colors focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 ${
            error ? "border-red-500" : ""
          } ${className}`}
          {...props}
        />
        {error && <p className="mt-1 text-sm text-red-400">{error}</p>}
      </div>
    );
  },
);

Input.displayName = "Input";
