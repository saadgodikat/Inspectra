import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { PlaceholderPage } from './pages/PlaceholderPage';

import { ProductsBatchesPage } from './pages/ProductsBatchesPage';
import { InspectionsPage } from './pages/InspectionsPage';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />

            <Route path="products" element={<ProductsBatchesPage />} />

            <Route path="inspections" element={<InspectionsPage />} />

            <Route
              path="reviews"
              element={
                <PlaceholderPage
                  title="Human Review & Defect Triage Queue"
                  phase="Phase 5"
                  description="Human-in-the-loop decision-support interface separating AI suggestions from human-confirmed outcomes."
                  features={[
                    'Side-by-side view of inspection image and ML suggestion score',
                    'Confirm, Correct, No Defect, and Needs More Evidence review actions',
                    'Independent human-confirmed defect persistence',
                    'Model result immutability guarantee',
                  ]}
                />
              }
            />

            <Route
              path="corrective-actions"
              element={
                <ProtectedRoute allowedRoles={['supervisor', 'quality_manager']}>
                  <PlaceholderPage
                    title="Corrective Action Lifecycle"
                    phase="Phase 5"
                    description="Supervised corrective action workflows for tracking repairs and follow-up evidence."
                    features={[
                      'Action assignment with target dates and notes',
                      'Supervisor repair evidence submission',
                      'Linked reinspection generation',
                      'Lifecycle state transitions: Open -> In Progress -> Completed -> Closed/Reopened',
                    ]}
                  />
                </ProtectedRoute>
              }
            />

            <Route
              path="batch-decisions"
              element={
                <ProtectedRoute allowedRoles={['quality_manager']}>
                  <PlaceholderPage
                    title="Separate Batch Hold / Release Workspace"
                    phase="Phase 6"
                    description="Independent quality management decision interface based on comprehensive batch inspection metrics."
                    features={[
                      'Batch item inspection counts, reviewed counts, and confirmed defect rates',
                      'Explicit human hold or release decisions with mandatory justification reason',
                      'Strict separation: individual image outcomes never automatically trigger batch releases',
                      'Full immutable audit log of quality decisions',
                    ]}
                  />
                </ProtectedRoute>
              }
            />

            <Route
              path="audit"
              element={
                <ProtectedRoute allowedRoles={['quality_manager']}>
                  <PlaceholderPage
                    title="System Audit Trail & Event Log"
                    phase="Phase 2+"
                    description="Immutable timeline of all state transitions, user decisions, and model inference runs."
                    features={[
                      'Structured change logging with actor ID and correlation IDs',
                      'Filterable by entity type (Product, Batch, Inspection, Review, Decision)',
                      'Audit export and compliance traceability',
                    ]}
                  />
                </ProtectedRoute>
              }
            />

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
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
