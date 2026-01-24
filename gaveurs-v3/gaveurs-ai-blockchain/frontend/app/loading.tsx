export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin mx-auto"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-amber-600 text-xl">🦆</span>
          </div>
        </div>
        <p className="mt-4 text-gray-600 font-medium">Chargement...</p>
      </div>
    </div>
  );
}
