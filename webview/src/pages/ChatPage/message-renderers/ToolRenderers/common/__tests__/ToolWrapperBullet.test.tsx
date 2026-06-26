import {describe, it, expect} from 'vitest';
import {render} from '@testing-library/react';
import {ToolWrapper, ToolStatusContext} from '../index';

function bulletOf(container: HTMLElement): HTMLElement {
    const dot = Array.from(container.querySelectorAll('span')).find((s) => s.textContent === '●');
    if (!dot) throw new Error('bullet not found');
    return dot;
}

describe('ToolWrapper bullet color', () => {
    it('is neutral (tertiary) by default with no provider', () => {
        const {container} = render(<ToolWrapper>body</ToolWrapper>);
        expect(bulletOf(container).className).toContain('text-text-tertiary');
    });

    it('is green for success status', () => {
        const {container} = render(
            <ToolStatusContext.Provider value="success">
                <ToolWrapper>body</ToolWrapper>
            </ToolStatusContext.Provider>
        );
        expect(bulletOf(container).className).toContain('text-state-success-fg');
    });

    it('is red for error status', () => {
        const {container} = render(
            <ToolStatusContext.Provider value="error">
                <ToolWrapper>body</ToolWrapper>
            </ToolStatusContext.Provider>
        );
        expect(bulletOf(container).className).toContain('text-state-error-fg');
    });

    it('is neutral for pending status', () => {
        const {container} = render(
            <ToolStatusContext.Provider value="pending">
                <ToolWrapper>body</ToolWrapper>
            </ToolStatusContext.Provider>
        );
        expect(bulletOf(container).className).toContain('text-text-tertiary');
    });

    it('blinks (animate-pulse) for progress status', () => {
        const {container} = render(
            <ToolStatusContext.Provider value="progress">
                <ToolWrapper>body</ToolWrapper>
            </ToolStatusContext.Provider>
        );
        expect(bulletOf(container).className).toContain('animate-pulse');
    });
});
