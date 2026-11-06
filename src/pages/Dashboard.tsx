import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTournamentStore } from '../store/useTournamentStore';
import { Button, Card } from '../components/ui/Common';
import { Link } from 'react-router-dom';
import { createDemoTournament, DEMO_TOURNAMENT_NAME } from '../logic/demoTournament';

export const Dashboard = () => {
  const { tournaments, loadTournaments, userRole, addTournament, deleteTournament } = useTournamentStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadTournaments();
  }, [loadTournaments]);

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-4xl font-bold text-primary">Tournament Dashboard</h1>
        {userRole === 'ORGANIZER' && (
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => {
              const existingDemo = tournaments.find(tournament => tournament.name === DEMO_TOURNAMENT_NAME);
              const demo = existingDemo ?? createDemoTournament();
              if (!existingDemo) addTournament(demo);
              navigate(`/tournament/${demo.id}/groups`);
            }}>Open 48-Team Demo</Button>
            <Link to="/setup"><Button>+ Create New</Button></Link>
          </div>
        )}
      </div>

      {tournaments.length === 0 ? (
        <Card className="text-center py-20">
          <p className="text-accent-grey mb-4">No tournaments found.</p>
          {userRole === 'ORGANIZER' && (
            <Link to="/setup">
              <Button variant="secondary">Create your first tournament</Button>
            </Link>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map(t => (
            <Card key={t.id} className="flex flex-col justify-between hover:border-primary transition-colors cursor-pointer group">
              <div>
                <h3 className="text-xl font-bold text-accent-white group-hover:text-primary transition-colors mb-2">
                  {t.name}
                </h3>
                <div className="flex gap-2 mb-4">
                  <span className="text-xs bg-zinc-800 text-accent-grey px-2 py-1 rounded">
                    {t.format.replace('_', ' ')}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    t.status === 'LIVE' ? 'bg-green-900 text-green-300' : t.status === 'FINISHED' ? 'bg-blue-900 text-blue-300' : 'bg-zinc-800 text-accent-grey'
                  }`}>
                    {t.status}
                  </span>
                </div>
                <p className="text-accent-grey text-sm mb-6">
                  {t.participants.length} Participants
                </p>
                {t.status === 'FINISHED' && (() => {
                  const reset = t.bracket.find(match => match.bracketType === 'FINAL_RESET');
                  const final = t.bracket.find(match => match.bracketType === 'FINAL');
                  const winnerId = reset?.winnerId ?? (final ? final.winnerId === final.participant1Id ? final.winnerId : null :
                    t.bracket.filter(match => !match.nextMatchId).sort((a, b) => b.round - a.round)[0]?.winnerId);
                  const winner = t.participants.find(participant => participant.id === winnerId);
                  return winner ? <p className="text-sm text-primary mb-4">Champion: {winner.name}</p> : null;
                })()}
              </div>
              <Link to={`/tournament/${t.id}`} className="w-full">
                <Button variant="secondary" className="w-full">View Details</Button>
              </Link>
              {userRole === 'ORGANIZER' && (
                <div className="mt-2 flex gap-2">
                  <Link to={`/tournament/${t.id}/participants`} className="flex-1">
                    <Button variant="secondary" className="w-full">Manage Participants</Button>
                  </Link>
                  <Button variant="danger" onClick={() => {
                    if (window.confirm(`Delete “${t.name}” and all its matches? This cannot be undone.`)) deleteTournament(t.id);
                  }}>Delete</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
