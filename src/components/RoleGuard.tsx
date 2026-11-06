import React from 'react';
import { useTournamentStore } from '../store/useTournamentStore';

export const RoleGuard = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) => {
  const { userRole } = useTournamentStore();

  if (!allowedRoles.includes(userRole)) {
    return (
      <div className="flex items-center justify-center p-4 bg-red-900/20 border border-red-900 text-red-400 rounded-md text-sm">
        Organizer access required for this action.
      </div>
    );
  }

  return <>{children}</>;
};
