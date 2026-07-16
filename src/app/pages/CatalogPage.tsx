import React from 'react';
import {
  PageSection,
  EmptyState,
  EmptyStateBody,
} from '@patternfly/react-core';

const CatalogPage: React.FC = () => (
  <PageSection>
    <EmptyState titleText="Catalog" headingLevel="h1">
      <EmptyStateBody>
        Browse available community plugins. Catalog content coming soon.
      </EmptyStateBody>
    </EmptyState>
  </PageSection>
);

export default CatalogPage;
