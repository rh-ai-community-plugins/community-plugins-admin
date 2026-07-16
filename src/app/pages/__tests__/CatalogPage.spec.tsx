import { render, screen } from '@testing-library/react';
import CatalogPage from '../CatalogPage';

describe('CatalogPage', () => {
  it('renders the page title', () => {
    render(<CatalogPage />);
    expect(screen.getByText('Catalog')).toBeInTheDocument();
  });

  it('renders the placeholder empty state', () => {
    render(<CatalogPage />);
    expect(
      screen.getByText(/browse available community plugins/i),
    ).toBeInTheDocument();
  });
});
