import { Link, useParams } from 'react-router-dom';
import { useTournamentStore } from '../../store/useTournamentStore';
import { Home } from 'lucide-react';

export const TopNav = () => {
  const { tournaments, userRole } = useTournamentStore();
  const { id } = useParams();
  const tournament = tournaments.find(t => t.id === id);

  return (
    <header className="h-16 bg-surface-dark border-b border-zinc-800 px-6 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <Link to="/dashboard" className="flex items-center gap-2 hover:text-primary transition-colors">
          <Home size={20} />
          <span className="font-bold tracking-tighter text-xl uppercase italic">BracketGen</span>
        </Link>
        {tournament && (
          <div className="h-6 w-px bg-zinc-800 mx-2"></div>
        )}
        {tournament && (
          <h2 className="text-accent-white font-medium">{tournament.name}</h2>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-950 border border-zinc-800">
          <div className={`w-2 h-2 rounded-full ${userRole === 'ORGANIZER' ? 'bg-primary' : 'bg-zinc-500'}`}></div>
          <span className="text-xs font-medium text-accent-grey uppercase tracking-widest">
            {userRole}
          </span>
        </div>
      </div>
    </header>
  );
};
