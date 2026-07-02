"use client";

import { forwardRef } from "react";
import { Search } from "lucide-react";

type SearchInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  value: string;
  onChange: (value: string) => void;
};

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  function SearchInput({ value, onChange, className = "", ...rest }, ref) {
    return (
      <div className={`relative ${className}`}>
        <span className="pointer-events-none absolute inset-y-px left-px flex w-10 items-center justify-center rounded-l-md border-r border-border/60 bg-muted/30 text-muted-foreground">
          <Search className="h-4 w-4" />
        </span>
        <input
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-full rounded-md border border-input bg-background pl-12 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          {...rest}
        />
      </div>
    );
  },
);
