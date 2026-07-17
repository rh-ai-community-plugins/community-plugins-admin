import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmRemoveModal from '../ConfirmRemoveModal';

describe('ConfirmRemoveModal', () => {
  it('renders modal when isOpen is true', () => {
    render(
      <ConfirmRemoveModal
        pluginName="my-plugin"
        isOpen={true}
        isLoading={false}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByText('Remove plugin')).toBeInTheDocument();
    expect(screen.getByText(/This action cannot be undone/)).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(
      <ConfirmRemoveModal
        pluginName="my-plugin"
        isOpen={false}
        isLoading={false}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.queryByText('Remove plugin')).not.toBeInTheDocument();
  });

  it('Remove button is disabled until plugin name matches', () => {
    render(
      <ConfirmRemoveModal
        pluginName="my-plugin"
        isOpen={true}
        isLoading={false}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    const removeBtn = screen.getByRole('button', { name: 'Remove' });
    expect(removeBtn).toBeDisabled();
  });

  it('Remove button is enabled when name matches', async () => {
    render(
      <ConfirmRemoveModal
        pluginName="my-plugin"
        isOpen={true}
        isLoading={false}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    const input = screen.getByLabelText('Confirm plugin name');
    await userEvent.type(input, 'my-plugin');
    const removeBtn = screen.getByRole('button', { name: 'Remove' });
    expect(removeBtn).not.toBeDisabled();
  });

  it('calls onConfirm when Remove is clicked with matching name', async () => {
    const onConfirm = jest.fn();
    render(
      <ConfirmRemoveModal
        pluginName="my-plugin"
        isOpen={true}
        isLoading={false}
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />,
    );
    const input = screen.getByLabelText('Confirm plugin name');
    await userEvent.type(input, 'my-plugin');
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onConfirm).toHaveBeenCalledWith(false);
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const onCancel = jest.fn();
    render(
      <ConfirmRemoveModal
        pluginName="my-plugin"
        isOpen={true}
        isLoading={false}
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('should disable input, Cancel, and Remove when isLoading is true', () => {
    render(
      <ConfirmRemoveModal
        pluginName="my-plugin"
        isOpen={true}
        isLoading={true}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByLabelText('Confirm plugin name')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    // PF6 loading button prepends the spinner's accessible name ("Loading...") to the button text
    const removeBtn = screen.getByRole('button', { name: /Remove/ });
    expect(removeBtn).toBeDisabled();
  });

  it('shows error helper text when typed name does not match', async () => {
    render(
      <ConfirmRemoveModal
        pluginName="my-plugin"
        isOpen={true}
        isLoading={false}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    const input = screen.getByLabelText('Confirm plugin name');
    await userEvent.type(input, 'wrong');
    expect(screen.getByText('Name does not match')).toBeInTheDocument();
  });
});
