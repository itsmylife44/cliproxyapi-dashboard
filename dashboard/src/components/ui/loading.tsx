export function LoadingSpinner({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="p-8 text-center">
      <div className="inline-flex items-center gap-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
        <span className="text-white/80">{message}</span>
      </div>
    </div>
  );
}
