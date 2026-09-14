export function Feedback({
  error,
  success,
}: {
  error?: string | null;
  success?: string | null;
}) {
  if (!error && !success) return null;
  return (
    <p className={`text-sm ${error ? "text-danger" : "text-success"}`}>
      {error ?? success}
    </p>
  );
}
