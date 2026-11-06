import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Common';

export const Navigation = () => {
  return (
    <nav className="flex justify-center gap-4 py-4 bg-surface-dark border-b border-zinc-800">
      <Link to="/dashboard">
        <Button variant="secondary" className="text-xs">Dashboard</Button>
      </Link>
      <Link to="/tournament/current/groups">
        <Button variant="secondary" className="text-xs">Groups</Button>
      </Link>
      <Link to="/tournament/current/bracket">
        <Button variant="secondary" className="text-xs">Bracket</Button>
      </Link>
    </nav>
  );
};
