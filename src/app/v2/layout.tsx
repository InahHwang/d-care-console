// src/app/v2/layout.tsx
import React from 'react';
import { Sidebar } from '@/components/v2/layout/Sidebar';
import { CTIPanel } from '@/components/v2/cti';

export default function V2Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">{children}</main>
      <CTIPanel />
    </div>
  );
}
