import React from 'react';
import { TopNav } from './TopNav';
import { Sidebar } from './Sidebar';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-bg-black text-accent-white flex flex-col">
      <TopNav />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 overflow-auto bg-bg-black">
          {children}
        </main>
      </div>
    </div>
  );
};
