import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '../features/auth/pages/LoginPage';
import ProtectedRoute from '../features/auth/components/ProtectedRoute';
import LandingPage from '../features/dashboard/pages/LandingPage';
import DashboardLayout from '../features/dashboard/components/DashboardLayout';
import UserManagement from '../features/users/pages/UserManagement';
import UserAnalytics from '../features/users/pages/UserAnalytics';
import PlanAnalytics from '../features/subscriptions/pages/PlanAnalytics';
import FinanceSubscribers from '../features/finance/pages/FinanceSubscribers';
import FinanceReconciliation from '../features/finance/pages/FinanceReconciliation';
import AdminManagement from '../features/users/pages/admins/AdminManagement';
import ContentManagement from '../features/documents/pages/ContentManagement';
import TemplateManagement from '../features/templates/pages/TemplateManagement/index';
import SubscriptionManagement from '../features/subscriptions/pages/SubscriptionManagement';
import SupportHelp from '../features/support/pages/SupportHelp';
import PromptManagement from '../features/ai-management/pages/PromptManagement';
import SystemPromptManagement from '../features/ai-management/pages/SystemPromptManagement';
import AgentList from '../features/ai-management/pages/agent-prompt';
import LLMManagement from '../features/ai-management/pages/LLMManagement';
import DocumentManagement from '../features/documents/pages/DocumentManagement';
import DemoManagement from '../features/marketing/pages/DemoManagement';
import ContactEnquiries from '../features/marketing/pages/ContactEnquiries';
import NewsletterSubscribers from '../features/marketing/pages/NewsletterSubscribers';
import MarketingPromos from '../features/marketing/pages/MarketingPromos';
import JudgementManagement from '../features/judgements/pages/JudgementManagement';
import JudgementSearch from '../features/judgements/pages/JudgementSearch';
import CitationManagement from '../features/citations/pages/CitationManagement';
import AddCaseType from '../features/documents/pages/content/AddCaseType';
import AddCourt from '../features/documents/pages/content/AddCourt';
import AddJudge from '../features/documents/pages/content/AddJudge';
import VoiceManagementPage from '../features/jurinex-voice/pages/VoiceManagementPage';
import RoleManagement from '../features/settings/pages/RoleManagement';
import Settings from '../features/settings/pages/Settings';
import AuditLogs from '../features/settings/pages/AuditLogs';
import SalesReferralsOverviewPage from '../features/sales-referrals/pages/SalesReferralsOverviewPage';
import SalesOwnerDetailPage from '../features/sales-referrals/pages/SalesOwnerDetailPage';
import ReferralSignupsPage from '../features/sales-referrals/pages/ReferralSignupsPage';
import ReferralDataPage from '../features/sales-referrals/pages/ReferralDataPage';
import { SALES_REFERRALS_ROUTES } from '../features/sales-referrals/salesReferrals.routes';
import { ROLE_HOME, RequireRole, DashboardIndex } from './routes';
import '../styles/global.css';
import '../styles/index.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    // Initialize isAuthenticated from localStorage on component mount
    const token = localStorage.getItem('token');
    // In a real application, you would decode the token and check its validity/expiration
    return !!token; // Returns true if token exists, false otherwise
  });

  // Placeholder for login logic
  const handleLogin = () => {
    setIsAuthenticated(true);
    // Redirection is now handled by LoginPage itself
  };

  // Placeholder for logout logic
  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('token'); // Clear token on logout
    setIsAuthenticated(false); // Update state on logout
  };

  // Effect to handle authentication status on initial load and token changes
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // In a real application, you would decode the token and check its expiration
      // For now, we'll just assume it's valid if it exists
      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
  }, []); // Empty dependency array means this effect runs once on mount

  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage setAuthStatus={setIsAuthenticated} />} />

        {/* Protected routes */}
        <Route element={<ProtectedRoute isAuthenticated={isAuthenticated} />}>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<DashboardIndex />} />
            <Route path="users" element={<RequireRole allow={['user-admin']}><UserManagement /></RequireRole>} />
            <Route path="users/:userId/analytics" element={<RequireRole allow={['user-admin', 'account-admin', 'finance-admin']}><UserAnalytics /></RequireRole>} />
            <Route path="firms/:firmId/analytics" element={<RequireRole allow={['user-admin', 'account-admin', 'finance-admin']}><UserAnalytics mode="firm" /></RequireRole>} />
            <Route path="admins" element={<RequireRole allow={[]}><AdminManagement /></RequireRole>} />
            <Route path="content" element={<RequireRole allow={['user-admin']}><ContentManagement /></RequireRole>} />
            <Route path="content/case-type" element={<RequireRole allow={['user-admin']}><AddCaseType /></RequireRole>} />
            <Route path="content/court" element={<RequireRole allow={['user-admin']}><AddCourt /></RequireRole>} />
            <Route path="content/judge" element={<RequireRole allow={['user-admin']}><AddJudge /></RequireRole>} />
            <Route path="templates" element={<RequireRole allow={[]}><TemplateManagement /></RequireRole>} />
            <Route path="subscriptions" element={<RequireRole allow={['account-admin', 'finance-admin']}><SubscriptionManagement /></RequireRole>} />
            <Route path="subscriptions/analytics" element={<RequireRole allow={['account-admin', 'finance-admin']}><PlanAnalytics /></RequireRole>} />
            <Route path="subscriptions/users" element={<RequireRole allow={['account-admin', 'finance-admin']}><FinanceSubscribers /></RequireRole>} />
            <Route path="subscriptions/reconciliation" element={<RequireRole allow={['account-admin', 'finance-admin']}><FinanceReconciliation /></RequireRole>} />
            <Route path="prompts" element={<RequireRole allow={[]}><PromptManagement /></RequireRole>} />
            <Route path="agent-prompts" element={<RequireRole allow={[]}><AgentList /></RequireRole>} />
            <Route path="system-prompts" element={<RequireRole allow={[]}><SystemPromptManagement /></RequireRole>} />
            <Route path="llm-management" element={<RequireRole allow={[]}><LLMManagement /></RequireRole>} />
            <Route path="documents" element={<RequireRole allow={['marketing-admin']}><DocumentManagement /></RequireRole>} />
            <Route path="demo-bookings" element={<RequireRole allow={['marketing-admin']}><DemoManagement /></RequireRole>} />
            <Route path="contact-enquiries" element={<RequireRole allow={['marketing-admin']}><ContactEnquiries /></RequireRole>} />
            <Route path="newsletter-subscribers" element={<RequireRole allow={['marketing-admin']}><NewsletterSubscribers /></RequireRole>} />
            <Route path="offers-events" element={<RequireRole allow={['marketing-admin']}><MarketingPromos /></RequireRole>} />
            <Route path="audit-logs" element={<RequireRole allow={[]}><AuditLogs /></RequireRole>} />
            {/* Sales Referrals — super-admin and finance-admin */}
            <Route path={SALES_REFERRALS_ROUTES.overview} element={<RequireRole allow={['finance-admin']}><SalesReferralsOverviewPage /></RequireRole>} />
            <Route path={SALES_REFERRALS_ROUTES.data} element={<RequireRole allow={['finance-admin']}><ReferralDataPage /></RequireRole>} />
            <Route path={SALES_REFERRALS_ROUTES.owner} element={<RequireRole allow={['finance-admin']}><SalesOwnerDetailPage /></RequireRole>} />
            <Route path={SALES_REFERRALS_ROUTES.codeSignups} element={<RequireRole allow={['finance-admin']}><ReferralSignupsPage /></RequireRole>} />
            <Route path={SALES_REFERRALS_ROUTES.ownerSignups} element={<RequireRole allow={['finance-admin']}><ReferralSignupsPage /></RequireRole>} />
            <Route path="judgements" element={<RequireRole allow={[]}><JudgementManagement /></RequireRole>} />
            <Route path="judgement-search" element={<RequireRole allow={[]}><JudgementSearch /></RequireRole>} />
            <Route path="citation-management" element={<RequireRole allow={[]}><CitationManagement /></RequireRole>} />
            <Route path="voice-management" element={<RequireRole allow={[]}><VoiceManagementPage /></RequireRole>} />
            <Route path="roles" element={<RequireRole allow={[]}><RoleManagement /></RequireRole>} />
            <Route path="support" element={<RequireRole allow={['support-admin']}><SupportHelp /></RequireRole>} />
            <Route path="support/admin/:managerId" element={<RequireRole allow={['support-admin']}><SupportHelp /></RequireRole>} />
            <Route path="support/user/:userId" element={<RequireRole allow={['support-admin']}><SupportHelp /></RequireRole>} />
            <Route path="support/:queryId" element={<RequireRole allow={['support-admin']}><SupportHelp /></RequireRole>} />
            {/* Settings is available to every authenticated admin role. */}
            <Route path="settings" element={<Settings />} />
          </Route>
        </Route>

        {/* Fallback for any unmatched routes */}
        <Route path="*" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
