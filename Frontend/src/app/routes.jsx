/**
 * Route guards + role landing pages (blueprint: app/routes.jsx).
 * Moved verbatim from App.jsx; App.jsx keeps the <Routes> tree.
 */
import React from 'react';
import { Navigate } from 'react-router-dom';
import DashboardContent from '../features/dashboard/pages/DashboardContent';
import { createDebugLogger } from '../shared/utils/debugLogger';

// Where each role lands by default and gets redirected when it hits a page
// it isn't allowed to see. Every role's home MUST be a route that role can
// access, otherwise RequireRole would redirect-loop.
// eslint-disable-next-line react-refresh/only-export-components -- route table + guards belong together
export const ROLE_HOME = {
  'super-admin': '/dashboard',
  'user-admin': '/dashboard/users',
  'account-admin': '/dashboard/subscriptions',
  'finance-admin': '/dashboard/subscriptions/users',
  'marketing-admin': '/dashboard/demo-bookings',
  'support-admin': '/dashboard/support',
};

// Route-level role guard. Hiding a sidebar item is only cosmetic; this blocks
// direct URL access for roles that aren't allowed on a given route.
// super-admin (and the legacy generic "admin") always pass, so each route only
// needs to list the ADDITIONAL non-super roles that may access it.
const roleGuardLogger = createDebugLogger('RequireRole');

export const RequireRole = ({ allow, children }) => {
  const role = localStorage.getItem('userRole');
  if (role === 'super-admin' || role === 'admin' || allow.includes(role)) {
    return children;
  }
  const home = ROLE_HOME[role] || '/dashboard';
  roleGuardLogger.flow('route:deny', {
    level: 'warn',
    summary: { role, home, allow },
  });
  return <Navigate to={home} replace />;
};

export const DashboardIndex = () => {
  const role = localStorage.getItem('userRole');
  // Roles without the generic dashboard land on their own home instead.
  if (role === 'marketing-admin' || role === 'support-admin' || role === 'finance-admin') {
    roleGuardLogger.event('dashboard-index:redirect', { role, home: ROLE_HOME[role] });
    return <Navigate to={ROLE_HOME[role]} replace />;
  }
  roleGuardLogger.event('dashboard-index:render', { role });
  return <DashboardContent />;
};

