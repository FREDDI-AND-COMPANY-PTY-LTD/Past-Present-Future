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
import AncestorTimeline from '@/pages/AncestorTimeline';
import MapPage from '@/pages/MapPage';
import TimelinePage from '@/pages/TimelinePage';
import FamilyTree from '@/pages/FamilyTree';
import UploadEvent from '@/pages/UploadEvent';
import AdminDashboard from '@/pages/AdminDashboard';
import BranchAdminDashboard from '@/pages/BranchAdminDashboard';
import Review from '@/pages/Review';

import ContentDetail from '@/pages/ContentDetail';
import Branches from '@/pages/Branches';
import ArchiveDataset from '@/pages/ArchiveDataset';
import Newsletters from '@/pages/Newsletters';
import NewsletterDetail from '@/pages/NewsletterDetail';
import Tasks from '@/pages/Tasks';
import CropReedit from '@/pages/CropReedit';
import ProposalDetail from '@/pages/ProposalDetail';
import Quiz from '@/pages/Quiz';
import OnboardingGate from '@/components/OnboardingGate';
import WelcomeAuthPopup from '@/components/WelcomeAuthPopup';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import GuestViewer from '@/pages/GuestViewer';

const AuthenticatedApp = () => {
  const { user, isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#0D0B0A]">
        <div className="w-8 h-8 border-4 border-[rgba(201,145,58,0.2)] border-t-[#C9913A] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError?.type === 'user_not_registered') {
    return <UserNotRegisteredError />;
  }

  // The archive is fully private: anyone without an authenticated session sees
  // the welcome popup instead of any app content.
  const showAuthGate = !user;

  return (
    <Routes>
      {/* Public auth routes — always accessible, even when the auth-required gate is active */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/trial/:token" element={<GuestViewer />} />

      {/* Gated application routes — behind the welcome popup (if not logged in) and the onboarding gate */}
      <Route element={showAuthGate ? <WelcomeAuthPopup /> : <OnboardingGate user={user} />}>
        <Route path="/" element={<Home />} />
        <Route path="/ancestors" element={<Ancestors />} />
        <Route path="/ancestor/:id" element={<AncestorProfile />} />
        <Route path="/ancestor/:id/timeline" element={<AncestorTimeline />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/timeline" element={<TimelinePage />} />
        <Route path="/family-tree" element={<FamilyTree />} />
        <Route path="/upload" element={<UploadEvent />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/branch-admin" element={<BranchAdminDashboard />} />
        <Route path="/app/review" element={<Review />} />

        <Route path="/content/:id" element={<ContentDetail />} />
        <Route path="/branches" element={<Branches />} />
        <Route path="/archive-dataset" element={<ArchiveDataset />} />
        <Route path="/newsletters" element={<Newsletters />} />
        <Route path="/newsletter/:id" element={<NewsletterDetail />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/crop-reedit" element={<CropReedit />} />
        <Route path="/proposal/:id" element={<ProposalDetail />} />
        <Route path="/quiz" element={<Quiz />} />
      </Route>

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