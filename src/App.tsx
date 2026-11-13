import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { TournamentSetup } from './pages/TournamentSetup';
import { GroupStage } from './pages/GroupStage';
import { BracketView } from './pages/BracketView';
import { ParticipantManagement } from './pages/ParticipantManagement';
import { GroupEditor } from './pages/GroupEditor';
import { useTournamentStore } from './store/useTournamentStore';
import { Button, Card } from './components/ui/Common';
import { AppShell } from './components/layout/AppShell';

const TournamentBootstrap = () => {
  const loadTournaments = useTournamentStore(state => state.loadTournaments);
  useEffect(() => loadTournaments(), [loadTournaments]);
  return null;
};

const TournamentLandingRedirect = () => {
  const tournaments = useTournamentStore(state => state.tournaments);
  const { id } = useParams();
  const tournament = tournaments.find(item => item.id === id);
  if (!tournament) return <Navigate to="/dashboard" replace />;
  return <Navigate to={tournament.format === 'GROUP_SINGLE' ? 'groups' : 'bracket'} replace />;
};

const Landing = () => {
  const { setRole } = useTournamentStore();
  const navigate = useNavigate();
  const enter = (role: 'ORGANIZER' | 'VIEWER') => {
    setRole(role);
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-black px-4">
      <Card className="max-w-md w-full text-center space-y-8 py-12">
        <div className="space-y-2">
          <h1 className="text-6xl font-black text-primary italic tracking-tighter">
            BRACKET<span className="text-accent-white">GEN</span>
          </h1>
          <p className="text-accent-grey text-lg">Professional Tournament Management</p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <Button
            variant="primary"
            className="py-4 text-xl shadow-[0_0_20px_rgba(250,204,21,0.3)]"
            onClick={() => enter('ORGANIZER')}
          >
            I am an Organizer
          </Button>
          <Button
            variant="secondary"
            className="py-4 text-xl"
            onClick={() => enter('VIEWER')}
          >
            I am a Viewer
          </Button>
        </div>
      </Card>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <TournamentBootstrap />
      <Routes>
        <Route path="/" element={<Landing />} />

        <Route path="/*" element={
          <AppShell>
            <Routes>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="setup" element={<TournamentSetup />} />
              <Route path="tournament/:id/participants" element={<ParticipantManagement />} />
              <Route path="tournament/:id" element={<TournamentLandingRedirect />} />
              <Route path="tournament/:id/groups" element={<GroupStage />} />
              <Route path="tournament/:id/groups/edit" element={<GroupEditor />} />
              <Route path="tournament/:id/bracket" element={<BracketView />} />
              <Route path="*" element={<Navigate to="/dashboard" />} />
            </Routes>
          </AppShell>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
