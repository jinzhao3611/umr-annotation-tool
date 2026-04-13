/**
 * @jest-environment jsdom
 */

const { addBranchToNode } = require('../tempBranchStorage');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a minimal DOM element that addBranchToNode can write to.
 * Passing it as customElement skips remapVariables, reinitializeEditor, etc.
 */
function makePre(text) {
    const pre = document.createElement('pre');
    pre.textContent = text;
    return pre;
}

/** Return the text after adding a branch. */
function addAndGet(annotation, variable, branchContent) {
    const pre = makePre(annotation);
    addBranchToNode(variable, branchContent, pre);
    return pre.textContent;
}

/** Count net parenthesis balance (should be 0 for valid Penman). */
function parenBalance(text) {
    let depth = 0;
    for (const ch of text) {
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
    }
    return depth;
}

// ---------------------------------------------------------------------------
// Tests — adding branch to a node with multiple closing parens on one line
// ---------------------------------------------------------------------------

describe('addBranchToNode – multiple closing parentheses', () => {
    test('node with )) on definition line: both parens move to new branch', () => {
        // (s1 / root
        //     :ARG1-of (s8x10 / 要-05))
        //
        // Adding :aspect state to s8x10 should produce:
        // (s1 / root
        //     :ARG1-of (s8x10 / 要-05
        //         :aspect state))
        const text = [
            '(s1 / root',
            '    :ARG1-of (s8x10 / 要-05))',
        ].join('\n');

        const result = addAndGet(text, 's8x10', ':aspect state');

        // The node definition line should NOT have any )
        expect(result).toContain('要-05\n');
        // The new branch should carry both ))
        expect(result).toContain(':aspect state))');
        expect(parenBalance(result)).toBe(0);
    });

    test('node with ))) on definition line: all parens move to new branch', () => {
        const text = [
            '(s0 / outer',
            '    :ARG0 (s1 / mid',
            '        :ARG1 (s2 / inner)))',
        ].join('\n');

        const result = addAndGet(text, 's2', ':aspect state');

        expect(result).toContain(':aspect state)))');
        expect(result).not.toMatch(/inner\)/);
        expect(parenBalance(result)).toBe(0);
    });

    test('node with ) on definition line (single paren): paren moves to new branch', () => {
        const text = '(s1 / root)';

        const result = addAndGet(text, 's1', ':aspect state');

        expect(result).toContain(':aspect state)');
        expect(result).not.toMatch(/root\)/);
        expect(parenBalance(result)).toBe(0);
    });

    test('node with inline child and )): parens after matching close move correctly', () => {
        // The line has nested content: (s1 / concept :mod (s2 / x)))
        // The ( for s1 matches the second ), third ) closes parent
        const text = [
            '(s0 / root',
            '    :ARG0 (s1 / concept :mod (s2 / x)))',
        ].join('\n');

        const result = addAndGet(text, 's1', ':aspect state');

        // The new branch should have )) — closing s1 and s0
        expect(result).toContain(':aspect state))');
        // The inline :mod (s2 / x) should remain on the definition line
        expect(result).toContain(':mod (s2 / x)');
        expect(parenBalance(result)).toBe(0);
    });
});

describe('addBranchToNode – no closing parens on definition line', () => {
    test('multi-line node: branch is inserted after definition, no paren issues', () => {
        const text = [
            '(s1 / root',
            '    :ARG0 (s2 / person)',
            '    :ARG1 (s3 / thing))',
        ].join('\n');

        const result = addAndGet(text, 's1', ':aspect state');

        // New branch should be after definition line
        expect(result).toContain('root\n');
        expect(result).toContain(':aspect state');
        // Closing parens on :ARG1 line should be unchanged
        expect(result).toContain('thing))');
        expect(parenBalance(result)).toBe(0);
    });
});

describe('addBranchToNode – parenthesis balance preserved', () => {
    test('bug-report scenario: adding to node inside nested structure', () => {
        // Simulates the real bug: (s8x10 / 要-05)) inside a parent
        const text = [
            '(s8 / sentence',
            '    :ARG1 (s8x1 / concept',
            '        :ARG1-of (s8x10 / 要-05',
            '            :mod (s8x11 / 不禁))))',
        ].join('\n');
        expect(parenBalance(text)).toBe(0);

        // Add :modal-strength to s8x10 — the definition line has no )
        const result = addAndGet(text, 's8x10', ':modal-strength full-affirmative');

        expect(parenBalance(result)).toBe(0);
        expect(result).toContain(':modal-strength full-affirmative');
        // The original ))) should still be at the end (on the :mod line)
        expect(result).toContain('不禁))))');
    });

    test('successive adds preserve balance', () => {
        // Start: node on one line with ))
        let text = [
            '(s1 / root',
            '    :ARG1-of (s8x10 / 要-05))',
        ].join('\n');
        expect(parenBalance(text)).toBe(0);

        // Add first branch
        let pre = makePre(text);
        addBranchToNode('s8x10', ':ARG0 s8x13', pre);
        text = pre.textContent;
        expect(parenBalance(text)).toBe(0);

        // Add second branch
        pre = makePre(text);
        addBranchToNode('s8x10', ':aspect state', pre);
        text = pre.textContent;
        expect(parenBalance(text)).toBe(0);

        // Add third branch
        pre = makePre(text);
        addBranchToNode('s8x10', ':modal-strength full-affirmative', pre);
        text = pre.textContent;
        expect(parenBalance(text)).toBe(0);

        // Branches are inserted at the top, so :ARG0 (added first) is the last child
        // and correctly carries the closing parens. Middle children should not.
        const lines = text.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            // :modal-strength and :aspect are middle children — no trailing )
            if (trimmed.startsWith(':modal-strength') || trimmed.startsWith(':aspect')) {
                expect(trimmed).not.toMatch(/\)$/);
            }
        }
        // The last child (:ARG0, added first) should carry the closing ))
        expect(text).toMatch(/:ARG0 s8x13\)+/);
        expect(text).toContain(':ARG0 s8x13))'); // )) closes s8x10 and s1
    });
});
