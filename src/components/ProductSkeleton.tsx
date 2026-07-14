export default function ProductSkeleton() {
  return (
    <div className="space-y-3">
      <div className="aspect-[3/4] rounded-2xl skeleton" />
      <div className="h-3 w-1/3 rounded skeleton" />
      <div className="h-3 w-2/3 rounded skeleton" />
      <div className="h-3 w-1/4 rounded skeleton" />
    </div>
  );
}
