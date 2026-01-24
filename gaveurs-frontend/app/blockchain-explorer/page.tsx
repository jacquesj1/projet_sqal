'use client';

import BlockchainExplorer from '@/components/BlockchainExplorer';

export default function BlockchainExplorerPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Blockchain Explorer</h1>
      <BlockchainExplorer />
    </div>
  );
}
