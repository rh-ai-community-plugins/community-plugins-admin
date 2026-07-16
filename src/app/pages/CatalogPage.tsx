import React from 'react';
import {
  PageSection,
  Title,
  EmptyState,
  EmptyStateBody,
} from '@patternfly/react-core';

const CatalogPage: React.FC = () => (
  <PageSection>
    <Title headingLevel="h1" size="lg">
      Catalog
    </Title>
    <EmptyState>
      <EmptyStateBody>
        Browse available community plugins. Catalog content coming soon.
      </EmptyStateBody>
    </EmptyState>
  </PageSection>
);

export default CatalogPage;
