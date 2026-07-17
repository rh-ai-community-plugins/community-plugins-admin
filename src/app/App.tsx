import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import {
  PageSection,
  EmptyState,
  EmptyStateBody,
  EmptyStateFooter,
  EmptyStateActions,
  Button,
} from '@patternfly/react-core';
import ExclamationTriangleIcon from '@patternfly/react-icons/dist/js/icons/exclamation-triangle-icon';
import CommunityBanner from './components/CommunityBanner';
import CatalogPage from './pages/CatalogPage';
import InstalledPage from './pages/InstalledPage';

interface ErrorBoundaryState {
  hasError: boolean;
}

class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <PageSection>
          <EmptyState
            titleText="Something went wrong"
            headingLevel="h2"
            icon={ExclamationTriangleIcon}
          >
            <EmptyStateBody>
              An unexpected error occurred in the Community Plugins Admin plugin.
            </EmptyStateBody>
            <EmptyStateFooter>
              <EmptyStateActions>
                <Button
                  variant="primary"
                  onClick={() => this.setState({ hasError: false })}
                >
                  Try again
                </Button>
              </EmptyStateActions>
            </EmptyStateFooter>
          </EmptyState>
        </PageSection>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => (
  <div className="community-plugin-layout">
    {/* [SHARED] Do not remove — all community plugins must display the CommunityBanner */}
    <CommunityBanner />
    <main className="community-plugin-content">
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Navigate to="catalog" replace />} />
          <Route path="catalog/*" element={<CatalogPage />} />
          <Route path="installed/*" element={<InstalledPage />} />
          <Route path="*" element={<Navigate to="catalog" replace />} />
        </Routes>
      </ErrorBoundary>
    </main>
  </div>
);

export default App;
