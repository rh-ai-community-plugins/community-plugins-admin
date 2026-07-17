import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('should render the content wrapper', () => {
    render(<App />);
    expect(document.querySelector('.community-plugin-content')).toBeInTheDocument();
  });

  describe('error boundary', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let routerMock: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let originalRoutes: any;
    let consoleSpy: jest.SpyInstance;

    beforeEach(() => {
      consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      routerMock = jest.requireMock('react-router-dom');
      originalRoutes = routerMock.Routes;
    });

    afterEach(() => {
      routerMock.Routes = originalRoutes;
      consoleSpy.mockRestore();
    });

    it('should catch errors and show recovery UI', () => {
      routerMock.Routes = () => {
        throw new Error('Test render error');
      };

      render(<App />);

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    });

    it('should reset error boundary when Try again is clicked', async () => {
      let shouldThrow = true;
      routerMock.Routes = ({ children }: { children: React.ReactNode }) => {
        if (shouldThrow) {
          throw new Error('Test render error');
        }
        return <div data-testid="routes-recovered">{children}</div>;
      };

      render(<App />);

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      shouldThrow = false;

      await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
      expect(screen.getByTestId('routes-recovered')).toBeInTheDocument();
    });
  });
});
