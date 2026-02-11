import { cn } from "@/lib/utils";

interface InputProps {
  type?: "text" | "password" | "email" | "number";
  id?: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  autoComplete?: string;
}

export function Input({
  type = "text",
  id,
  name,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  className,
  autoComplete,
}: InputProps) {
  return (
    <input
      type={type}
      id={id ?? name}
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      required={required}
      disabled={disabled}
      autoComplete={autoComplete}
      className={cn(
          "w-full px-3 py-2 text-sm rounded-md",
          "glass-input text-white",
          "focus:outline-none focus:border-blue-400/50 focus:ring-1 focus:ring-blue-400/30",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "placeholder:text-slate-500 transition-colors duration-200",
          className
        )}
    />
  );
}
