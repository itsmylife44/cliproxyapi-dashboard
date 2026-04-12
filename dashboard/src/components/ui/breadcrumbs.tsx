"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

function ChevronRight() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-[var(--surface-border)]"
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  const t = useTranslations('common');
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center gap-1.5 text-sm text-[var(--text-muted)] mb-4", className)}
    >
      <ol className="flex items-center gap-1.5">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={`${item.href ?? ""}-${item.label}`} className="flex items-center gap-1.5">
              {isLast || !item.href ? (
                <span
                  className={cn(
                    isLast ? "text-[var(--text-primary)] font-medium" : "text-[var(--text-muted)]"
                  )}
                  aria-current={isLast ? "page" : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-[var(--text-primary)] transition-colors duration-150"
                >
                  {item.label}
                </Link>
              )}
              {!isLast && <ChevronRight />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
