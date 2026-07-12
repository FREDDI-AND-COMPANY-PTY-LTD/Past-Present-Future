import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import Home from '@/pages/Home';
import Ancestors from '@/pages/Ancestors';
import AncestorProfile from '@/pages/AncestorProfile';
import MapPage from '@/pages/MapPage';
import TimelinePage from '@/pages/TimelinePage';
import FamilyTree from '@/pages/FamilyTree';
import UploadEvent from '@/pages/UploadEvent';
import AdminDashboard from '@/pages/AdminDashboard';
import AdminInbox from '@/pages/AdminInbox';
import ContentDetail from '@/pages/ContentDetail';
import Branches from '@/pages/Branches';
import ArchiveDataset from '@/pages/ArchiveDataset';
import Newsletters from '@/pages/Newsletters';
import NewsletterDetail from '@/pages/NewsletterDetail';
import Tasks from '@/pages/Tasks';
import MigrationJourney from '@/pages/MigrationJourney';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0D0B0A]">
        <div className="w-8 h-8 border-4 border-[rgba(201,145,58,0.2)] border-t-[#C9913A] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/ancestors" element={<Ancestors />} />
      <Route path="/ancestor/:id" element={<AncestorProfile />} />
      <Route path="/map" element={<MapPage />} />
      <Route path="/timeline" element={<TimelinePage />} />
      <Route path="/family-tree" element={<FamilyTree />} />
      <Route path="/upload" element={<UploadEvent />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin-inbox" element={<AdminInbox />} />
      <Route path="/content/:id" element={<ContentDetail />} />
      <Route path="/branches" element={<Branches />} />
      <Route path="/archive-dataset" element={<ArchiveDataset />} />
      <Route path="/newsletters" element={<Newsletters />} />
      <Route path="/newsletter/:id" element={<NewsletterDetail />} />
      <Route path="/tasks" element={<Tasks />} />
      <Route path="/migration-journey" element={<MigrationJourney />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App