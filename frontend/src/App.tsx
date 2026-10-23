import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './layouts/AppLayout';

/* ── Lazy-loaded page chunks ── */
const InspectionsPage = React.lazy(() =>
  import('./pages/InspectionsPage').then((m) => ({ default: m.InspectionsPage }))
);
const DefectTrackerPage = React.lazy(() =>
  import('./pages/DefectTrackerPage').then((m) => ({ default: m.DefectTrackerPage }))
);
const BatchReleasesPage = React.lazy(() =>
  import('./pages/BatchReleasesPage').then((m) => ({ default: m.BatchReleasesPage }))
);
const QualityAnalyticsPage = React.lazy(() =>
  import('./pages/QualityAnalyticsPage').then((m) => ({ default: m.QualityAnalyticsPage }))
);
const AuditTrailPage = React.lazy(() =>
  import('./pages/AuditTrailPage').then((m) => ({ default: m.AuditTrailPage }))
);
const ProductsBatchesPage = React.lazy(() =>
  import('./pages/ProductsBatchesPage').then((m) => ({ default: m.ProductsBatchesPage }))
);
const UsersPage = React.lazy(() =>
  import('./pages/UsersPage').then((m) => ({ default: m.UsersPage }))
);
const DashboardPage = React.lazy(() =>
  import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage }))
);
const ChatbotPage = React.lazy(() =>
  import('./pages/ChatbotPage').then((m) => ({ default: m.ChatbotPage }))
);

/* ── Route loading fallback ── */
const PageLoader: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-[60vh] gap-4 select-none">
    <div className="relative w-10 h-10">
      <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
      <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
    </div>
    <span className="text-body-sm font-mono text-outline uppercase tracking-widest">
      Loading Module...
    </span>
  </div>
);

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              {/* Command Center Dashboard is the landing page */}
              <Route index element={<DashboardPage />} />

              {/* Inspection Runs & Station Telemetry Console */}
              <Route path="inspections" element={<InspectionsPage />} />

              {/* Defect Tracker & Root Cause CAPA Workstation */}
              <Route path="reviews" element={<DefectTrackerPage />} />

              {/* Batch Releases & 21 CFR Part 11 Quality Gates */}
              <Route
                path="batch-decisions"
                element={
                  <ProtectedRoute allowedRoles={['quality_manager', 'supervisor']}>
                    <BatchReleasesPage />
                  </ProtectedRoute>
                }
              />

              {/* Statistical Process Control & Pareto Yield Analytics */}
              <Route path="analytics" element={<QualityAnalyticsPage />} />
              <Route path="chatbot" element={<ChatbotPage />} />

              {/* Products & Lots Catalog */}
              <Route path="products" element={<ProductsBatchesPage />} />

              {/* 21 CFR Part 11 Audit Trail & Ledger */}
              <Route
                path="audit"
                element={
                  <ProtectedRoute allowedRoles={['quality_manager']}>
                    <AuditTrailPage />
                  </ProtectedRoute>
                }
              />

              {/* User Management */}
              <Route
                path="users"
                element={
                  <ProtectedRoute allowedRoles={['quality_manager']}>
                    <UsersPage />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
