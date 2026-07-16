import { render, screen } from '@testing-library/react';
import InstalledPage from '../InstalledPage';

describe('InstalledPage', () => {
  it('renders the page title', () => {
    render(<InstalledPage />);
    expect(screen.getByText('Installed Plugins')).toBeInTheDocument();
  });

  it('renders the placeholder empty state', () => {
    render(<InstalledPage />);
    expect(
      screen.getByText(/view and manage installed community plugins/i),
    ).toBeInTheDocument();
  });
});
