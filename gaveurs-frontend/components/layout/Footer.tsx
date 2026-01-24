'use client';

export default function Footer() {
  return (
    <footer className="bg-gray-800 text-gray-300 py-6 mt-auto">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🦆</span>
            <span className="font-bold text-white">Système Gaveurs V2.1</span>
          </div>

          <div className="text-sm text-center md:text-right">
            <p>© {new Date().getFullYear()} Gaveurs AI Blockchain</p>
            <p className="text-gray-500">Traçabilité et Intelligence Artificielle pour le Gavage</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
