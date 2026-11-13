import { Link, useParams } from 'react-router-dom';
import { LayoutDashboard, Settings, Users, Trophy, UserRound, Pencil } from 'lucide-react';
import { useTournamentStore } from '../../store/useTournamentStore';

export const Sidebar = () => {
  const { id } = useParams();
  const { tournaments, userRole } = useTournamentStore();
  const tournament = tournaments.find(item => item.id === id);

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    ...(userRole === 'ORGANIZER' ? [{ name: 'Setup', path: '/setup', icon: Settings }] : []),
    ...(id ? [{ name: 'Participants', path: `/tournament/${id}/participants`, icon: UserRound }] : []),
    ...(tournament?.format === 'GROUP_SINGLE' ? [{ name: 'Groups', path: `/tournament/${id}/groups`, icon: Users }] : []),
    ...(tournament?.format === 'GROUP_SINGLE' && userRole === 'ORGANIZER' ? [{ name: 'Edit groups', path: `/tournament/${id}/groups/edit`, icon: Pencil }] : []),
    { name: 'Bracket', path: id ? `/tournament/${id}/bracket` : '#', icon: Trophy },
  ];

  return (
    <aside className="w-64 bg-surface-dark border-r border-zinc-800 h-[calc(100vh-64px)] flex flex-col sticky top-16">
      <div className="flex-1 px-4 py-6 space-y-2">
        {navItems.map(item => {
          const isDisabled = item.path === '#';
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                isDisabled
                  ? 'text-zinc-700 cursor-not-allowed opacity-50'
                  : 'text-accent-grey hover:bg-zinc-800 hover:text-primary'
              }`}
              onClick={(e) => isDisabled && e.preventDefault()}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-zinc-800">
        <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800">
          <p className="text-xs text-accent-grey mb-2">Tournament Status</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
            <span className="text-sm font-bold text-accent-white">System Online</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
