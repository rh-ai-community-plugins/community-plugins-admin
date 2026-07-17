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
import CommunityBanner from '~/app/components/CommunityBanner';
import CatalogPage from '~/app/pages/CatalogPage';
import InstalledPage from '~/app/pages/InstalledPage';

interface ErrorBoundaryState {
  hasError: boolean;
  retryKey: number;
}

class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, retryKey: 0 };

  static getDerivedStateFromError(): Pick<ErrorBoundaryState, 'hasError'> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Community Plugins Admin error:', error, errorInfo.componentStack);
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
                  onClick={() =>
                    this.setState((prev) => ({ hasError: false, retryKey: prev.retryKey + 1 }))
                  }
                >
                  Try again
                </Button>
              </EmptyStateActions>
            </EmptyStateFooter>
          </EmptyState>
        </PageSection>
      );
    }
    return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>;
  }
}

const App: React.FC = () => (
  <div className="community-plugin-layout">
    {/* [SHARED] Do not remove — all community plugins must display the CommunityBanner */}
    <CommunityBanner />
    <div className="community-plugin-content">
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<Navigate to="catalog" replace />} />
          <Route path="catalog/*" element={<CatalogPage />} />
          <Route path="installed/*" element={<InstalledPage />} />
          <Route path="*" element={<Navigate to="catalog" replace />} />
        </Routes>
      </ErrorBoundary>
    </div>
  </div>
);

export default App;
