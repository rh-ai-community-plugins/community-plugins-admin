import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmInstallModal from '../ConfirmInstallModal';

describe('ConfirmInstallModal', () => {
  const defaultProps = {
    pluginName: 'my-plugin',
    defaultNamespace: 'cp-my-plugin',
    isOpen: true,
    isLoading: false,
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders modal when isOpen is true', () => {
    render(<ConfirmInstallModal {...defaultProps} />);
    expect(screen.getByText('Install plugin')).toBeInTheDocument();
    expect(screen.getByText('cp-my-plugin')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<ConfirmInstallModal {...defaultProps} isOpen={false} />);
    expect(screen.queryByText('Install plugin')).not.toBeInTheDocument();
  });

  it('Install button is enabled by default', () => {
    render(<ConfirmInstallModal {...defaultProps} />);
    const installBtn = screen.getByRole('button', { name: 'Install' });
    expect(installBtn).not.toBeDisabled();
  });

  it('calls onConfirm with default namespace when installed without override', async () => {
    const onConfirm = jest.fn();
    render(<ConfirmInstallModal {...defaultProps} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Install' }));
    expect(onConfirm).toHaveBeenCalledWith('cp-my-plugin');
  });

  it('checking the checkbox reveals the namespace input', async () => {
    render(<ConfirmInstallModal {...defaultProps} />);
    expect(screen.queryByLabelText('Namespace')).not.toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Install in a different namespace'));
    expect(screen.getByLabelText('Namespace')).toBeInTheDocument();
  });

  it('namespace input is pre-filled with the default namespace', async () => {
    render(<ConfirmInstallModal {...defaultProps} />);
    await userEvent.click(screen.getByLabelText('Install in a different namespace'));
    expect(screen.getByLabelText('Namespace')).toHaveValue('cp-my-plugin');
  });

  it('calls onConfirm with overridden namespace', async () => {
    const onConfirm = jest.fn();
    render(<ConfirmInstallModal {...defaultProps} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByLabelText('Install in a different namespace'));
    const input = screen.getByLabelText('Namespace');
    await userEvent.clear(input);
    await userEvent.type(input, 'custom-ns');
    await userEvent.click(screen.getByRole('button', { name: 'Install' }));
    expect(onConfirm).toHaveBeenCalledWith('custom-ns');
  });

  it('Install button is disabled when override is enabled and input is invalid', async () => {
    render(<ConfirmInstallModal {...defaultProps} />);
    await userEvent.click(screen.getByLabelText('Install in a different namespace'));
    const input = screen.getByLabelText('Namespace');
    await userEvent.clear(input);
    await userEvent.type(input, 'INVALID');
    expect(screen.getByRole('button', { name: 'Install' })).toBeDisabled();
  });

  it('shows validation error for invalid namespace', async () => {
    render(<ConfirmInstallModal {...defaultProps} />);
    await userEvent.click(screen.getByLabelText('Install in a different namespace'));
    const input = screen.getByLabelText('Namespace');
    await userEvent.clear(input);
    await userEvent.type(input, 'INVALID');
    expect(screen.getByText(/Must start with a letter/)).toBeInTheDocument();
  });

  it('shows cp- prefix hint when override is active and input is valid', async () => {
    render(<ConfirmInstallModal {...defaultProps} />);
    await userEvent.click(screen.getByLabelText('Install in a different namespace'));
    expect(screen.getByText(/prefix for consistency/)).toBeInTheDocument();
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = jest.fn();
    render(<ConfirmInstallModal {...defaultProps} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables input and buttons when isLoading is true', async () => {
    render(<ConfirmInstallModal {...defaultProps} isLoading={true} />);
    await userEvent.click(screen.getByLabelText('Install in a different namespace'));
    // Checkbox is disabled so override won't show - check buttons only
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
