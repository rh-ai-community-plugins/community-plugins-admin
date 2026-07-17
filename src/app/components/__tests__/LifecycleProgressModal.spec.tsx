import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LifecycleProgressModal from '../LifecycleProgressModal';
import { LifecycleStep } from '~/app/types/lifecycle';

const sampleSteps: LifecycleStep[] = [
  { id: 'resolve', label: 'Resolve plugin metadata', status: 'completed' },
  { id: 'helm-install', label: 'Install Helm chart', status: 'running' },
  { id: 'update-config', label: 'Register plugin in dashboard', status: 'pending' },
];

describe('LifecycleProgressModal', () => {
  it('renders nothing when operation is null', () => {
    const { container } = render(
      <LifecycleProgressModal
        isOpen={true}
        operation={null}
        steps={[]}
        success={null}
        message={null}
        onClose={jest.fn()}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders progress steps with completed state', () => {
    const completedSteps = sampleSteps.map((s) => ({ ...s, status: 'completed' as const }));
    render(
      <LifecycleProgressModal
        isOpen={true}
        operation="install"
        steps={completedSteps}
        success={true}
        message="Done"
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText('Plugin installed')).toBeInTheDocument();
    expect(screen.getByText('Resolve plugin metadata')).toBeInTheDocument();
    expect(screen.getByText('Install Helm chart')).toBeInTheDocument();
    expect(screen.getByText('Register plugin in dashboard')).toBeInTheDocument();
  });

  it('shows Done button and success alert when success is true', () => {
    render(
      <LifecycleProgressModal
        isOpen={true}
        operation="install"
        steps={sampleSteps.map((s) => ({ ...s, status: 'completed' as const }))}
        success={true}
        message="Plugin installed successfully"
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText('Plugin installed')).toBeInTheDocument();
    expect(screen.getByText('Plugin installed successfully')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).not.toBeDisabled();
  });

  it('shows error alert when success is false', () => {
    const failedSteps = [
      { id: 'resolve', label: 'Resolve plugin metadata', status: 'completed' as const },
      { id: 'helm-install', label: 'Install Helm chart', status: 'failed' as const, error: 'Helm timed out' },
    ];
    render(
      <LifecycleProgressModal
        isOpen={true}
        operation="install"
        steps={failedSteps}
        success={false}
        message="Failed to install"
        onClose={jest.fn()}
      />,
    );
    expect(screen.getByText('Operation failed')).toBeInTheDocument();
    expect(screen.getByText('Failed to install')).toBeInTheDocument();
  });

  it('should show in-progress title and disabled button when operation is in progress', () => {
    const onClose = jest.fn();
    const inProgressSteps: LifecycleStep[] = [
      { id: 'resolve', label: 'Resolve plugin metadata', status: 'completed' },
      { id: 'helm-install', label: 'Install Helm chart', status: 'running' },
      { id: 'update-config', label: 'Register plugin in dashboard', status: 'pending' },
    ];
    render(
      <LifecycleProgressModal
        isOpen={true}
        operation="install"
        steps={inProgressSteps}
        success={null}
        message={null}
        onClose={onClose}
      />,
    );
    expect(screen.getByText('Installing plugin')).toBeInTheDocument();
    const closeBtn = screen.getByRole('button', { name: /close/i });
    expect(closeBtn).toHaveAttribute('aria-disabled', 'true');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('does not call onClose when Close is clicked while operation is in progress', async () => {
    const onClose = jest.fn();
    render(
      <LifecycleProgressModal
        isOpen={true}
        operation="install"
        steps={sampleSteps}
        success={null}
        message={null}
        onClose={onClose}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Done is clicked', async () => {
    const onClose = jest.fn();
    render(
      <LifecycleProgressModal
        isOpen={true}
        operation="remove"
        steps={[{ id: 'done', label: 'Done', status: 'completed' }]}
        success={true}
        message="Removed"
        onClose={onClose}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
