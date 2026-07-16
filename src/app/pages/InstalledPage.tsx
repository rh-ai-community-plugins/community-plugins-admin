import React from 'react';
import {
  PageSection,
  Title,
  EmptyState,
  EmptyStateBody,
} from '@patternfly/react-core';

const InstalledPage: React.FC = () => (
  <PageSection>
    <Title headingLevel="h1" size="lg">
      Installed Plugins
    </Title>
    <EmptyState>
      <EmptyStateBody>
        View and manage installed community plugins. Content coming soon.
      </EmptyStateBody>
    </EmptyState>
  </PageSection>
);

export default InstalledPage;
