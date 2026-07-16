import { render, screen } from '@testing-library/react';
import App from '../App';

jest.mock('../pages/CatalogPage', () => {
  const MockPage = () => <div data-testid="catalog-page">Catalog Page</div>;
  MockPage.displayName = 'MockCatalogPage';
  return { __esModule: true, default: MockPage };
});

jest.mock('../pages/InstalledPage', () => {
  const MockPage = () => <div data-testid="installed-page">Installed Page</div>;
  MockPage.displayName = 'MockInstalledPage';
  return { __esModule: true, default: MockPage };
});

describe('App Component', () => {
  it('should render the first route element', () => {
    render(<App />);
    expect(screen.getByTestId('routes')).toBeInTheDocument();
  });
});
