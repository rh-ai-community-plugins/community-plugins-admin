import React from 'react';
import {
  PageSection,
  EmptyState,
  EmptyStateBody,
} from '@patternfly/react-core';

const InstalledPage: React.FC = () => (
  <PageSection>
    <EmptyState titleText="Installed Plugins" headingLevel="h1">
      <EmptyStateBody>
        View and manage installed community plugins. Content coming soon.
      </EmptyStateBody>
    </EmptyState>
  </PageSection>
);

export default InstalledPage;
