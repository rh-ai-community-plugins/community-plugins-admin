import React from 'react';
import { render } from '@testing-library/react';
import CommunityPluginsAdminIcon from '../CommunityPluginsAdminNavIcon';

describe('CommunityPluginsAdminNavIcon (CommunityPluginsAdminIcon) Component', () => {
  it('should render the SVG icon', () => {
    const { container } = render(<CommunityPluginsAdminIcon />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should use PatternFly SVG conventions', () => {
    const { container } = render(<CommunityPluginsAdminIcon />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '1em');
    expect(svg).toHaveAttribute('height', '1em');
    expect(svg).toHaveAttribute('viewBox', '0 0 32 32');
    expect(svg).toHaveClass('pf-v6-svg');
    expect(svg).toHaveAttribute('role', 'img');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('should render the CP text', () => {
    const { container } = render(<CommunityPluginsAdminIcon />);
    const textElement = container.querySelector('text');
    expect(textElement).toBeInTheDocument();
    expect(textElement?.textContent).toBe('CP');
  });

  it('should render the rectangle background with purple fill', () => {
    const { container } = render(<CommunityPluginsAdminIcon />);
    const rect = container.querySelector('rect');
    expect(rect).toBeInTheDocument();
    expect(rect).toHaveAttribute('fill', '#7d1007');
  });

  it('should have white bold centered text', () => {
    const { container } = render(<CommunityPluginsAdminIcon />);
    const text = container.querySelector('text');
    expect(text).toHaveAttribute('fill', 'white');
    expect(text).toHaveAttribute('font-weight', 'bold');
    expect(text).toHaveAttribute('text-anchor', 'middle');
  });
});
