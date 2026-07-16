import { render, screen } from '@testing-library/react';
import PluginDetailModal from '../PluginDetailModal';

describe('PluginDetailModal', () => {
  it('renders the modal when pluginName is provided', () => {
    render(<PluginDetailModal pluginName="test-plugin" onClose={jest.fn()} />);
    expect(screen.getByText('test-plugin')).toBeInTheDocument();
    expect(
      screen.getByText('Plugin detail content coming soon.'),
    ).toBeInTheDocument();
  });

  it('does not render modal content when pluginName is null', () => {
    render(<PluginDetailModal pluginName={null} onClose={jest.fn()} />);
    expect(
      screen.queryByText('Plugin detail content coming soon.'),
    ).not.toBeInTheDocument();
  });
});
