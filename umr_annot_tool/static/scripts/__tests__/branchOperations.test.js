/**
 * @jest-environment jsdom
 */

// Globals that branch_operations.js calls at runtime
global.showNotification = jest.fn();
global.saveBranchDeletion = jest.fn();
global.makeRelationsClickable = jest.fn();
global.makeValuesClickable = jest.fn();
global.makeVariablesClickable = jest.fn();
global.addBranchOperations = jest.fn();

// Load the IIFE – this sets window.deleteBranch, window.moveBranch, etc.
require('../branch_operations');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a DOM structure that mirrors what the annotation editor produces:
 *   <div id="amr"><pre>…text with <span class="relation-span">…</span>…</pre></div>
 */
function buildAnnotationDOM(text) {
    const amrDiv = document.createElement('div');
    amrDiv.id = 'amr';
    const pre = document.createElement('pre');

    const relationPattern = /(:[A-Za-z0-9_-]+)/g;
    let lastIndex = 0;
    let match;
    while ((match = relationPattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
            pre.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }
        const span = document.createElement('span');
        span.className = 'relation-span';
        span.textContent = match[1];
        pre.appendChild(span);
        lastIndex = match.index + match[1].length;
    }
    if (lastIndex < text.length) {
        pre.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    amrDiv.appendChild(pre);
    document.body.appendChild(amrDiv);
    return pre;
}

/** Find the Nth (0-based) relation span with the given name. */
function getRelationSpan(pre, relationName, index = 0) {
    const spans = Array.from(pre.querySelectorAll('.relation-span'))
        .filter(s => s.textContent === relationName);
    return spans[index];
}

/** Return the annotation text after a deleteBranch call. */
function deleteAndGetResult(text, relationName, spanIndex = 0) {
    const pre = buildAnnotationDOM(text);
    const span = getRelationSpan(pre, relationName, spanIndex);
    expect(span).toBeDefined();
    window.deleteBranch(span);
    return document.querySelector('#amr pre').textContent;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
});

describe('deleteBranch – simple branches with trailing closing parentheses', () => {
    test('reported bug: deleting :modal-strength undefined)) preserves ))', () => {
        // Exact scenario from the bug report
        const text = [
            '(s14x36 / 缺失-01',
            '    :modal-strength full-affirmative',
            '    :aspect state',
            '        :ARG1 (s14x37 / 人才',
            '                :mod (s14x1 / 顶尖))',
            '        :duration (s14x39 / 長久)',
            '        :modal-strength undefined))',
        ].join('\n');

        const result = deleteAndGetResult(text, ':modal-strength', 1); // second :modal-strength

        // The )) must be preserved – they close parent structures
        expect(result).toContain('長久)))');
        expect(result).not.toContain('undefined');
        // First :modal-strength should still be present
        expect(result).toContain(':modal-strength full-affirmative');
    });

    test('single trailing ) is preserved', () => {
        const text = [
            '(s1 / say-01',
            '    :ARG0 (s2 / person',
            '        :aspect state)',
            '    :ARG1 (s3 / thing))',
        ].join('\n');

        const result = deleteAndGetResult(text, ':aspect');

        // The ) closes (s2 / person – it must stay
        expect(result).toContain('person)');
        expect(result).not.toContain('aspect');
        expect(result).not.toContain('state');
    });

    test('three trailing ))) are all preserved', () => {
        const text = [
            '(s1 / root',
            '    :ARG0 (s2 / mid',
            '        :ARG1 (s3 / inner',
            '            :aspect state)))',
        ].join('\n');

        const result = deleteAndGetResult(text, ':aspect');

        expect(result).toContain('inner)))');
        expect(result).not.toContain('aspect');
    });
});

describe('deleteBranch – simple branches without trailing parens', () => {
    test('deleting a mid-graph simple branch works', () => {
        const text = [
            '(s1 / say-01',
            '    :aspect state',
            '    :ARG0 (s2 / person))',
        ].join('\n');

        const result = deleteAndGetResult(text, ':aspect');

        expect(result).not.toContain('aspect');
        expect(result).not.toContain('state');
        expect(result).toContain(':ARG0');
        expect(result).toContain('person');
    });

    test('deleting last simple branch (no trailing parens) keeps graph intact', () => {
        const text = [
            '(s1 / say-01',
            '    :ARG0 (s2 / person)',
            '    :modal-strength full-affirmative)',
        ].join('\n');

        const result = deleteAndGetResult(text, ':modal-strength');

        expect(result).toContain('person)');
        expect(result).not.toContain('modal-strength');
        expect(result).not.toContain('full-affirmative');
        // The final ) closing s1 must remain
        expect(result).toContain('say-01');
    });
});

describe('deleteBranch – complex branches (parenthesized)', () => {
    test('deleting a balanced complex branch works', () => {
        const text = [
            '(s1 / say-01',
            '    :ARG0 (s2 / person)',
            '    :ARG1 (s3 / thing))',
        ].join('\n');

        const result = deleteAndGetResult(text, ':ARG0');

        expect(result).not.toContain('person');
        expect(result).toContain(':ARG1');
        expect(result).toContain('thing');
    });

    test('deleting a deeply nested complex branch works', () => {
        const text = [
            '(s1 / obligate-01',
            '    :ARG1 (s2 / cross-02',
            '        :ARG0 (s3 / person',
            '            :ARG0-of (s4 / have-org-role-91',
            '                :ARG2 (s5 / president)))',
            '        :ARG1 (s6 / border)))',
        ].join('\n');

        const result = deleteAndGetResult(text, ':ARG1', 1); // inner :ARG1

        expect(result).not.toContain('border');
        expect(result).toContain('president');
        expect(result).toContain('cross-02');
    });
});

describe('deleteBranch – parenthesis balance after deletion', () => {
    /** Count net paren balance: should be 0 for a valid Penman graph */
    function parenBalance(text) {
        let depth = 0;
        for (const ch of text) {
            if (ch === '(') depth++;
            else if (ch === ')') depth--;
        }
        return depth;
    }

    test('balance is preserved after deleting simple branch with trailing parens', () => {
        const text = [
            '(s1 / root',
            '    :ARG0 (s2 / child',
            '        :modal-strength undefined))',
        ].join('\n');
        expect(parenBalance(text)).toBe(0);

        const result = deleteAndGetResult(text, ':modal-strength');
        expect(parenBalance(result)).toBe(0);
    });

    test('balance is preserved after deleting complex branch', () => {
        const text = [
            '(s1 / say-01',
            '    :ARG0 (s2 / person)',
            '    :ARG1 (s3 / thing))',
        ].join('\n');
        expect(parenBalance(text)).toBe(0);

        const result = deleteAndGetResult(text, ':ARG0');
        expect(parenBalance(result)).toBe(0);
    });

    test('balance preserved: bug-report scenario', () => {
        // The )) after undefined closes (s14x36 and (root – full balanced tree
        const text = [
            '(root / root-01',
            '    :op1 (s14x36 / 缺失-01',
            '        :modal-strength full-affirmative',
            '        :aspect state',
            '        :ARG1 (s14x37 / 人才',
            '                :mod (s14x1 / 顶尖))',
            '        :duration (s14x39 / 長久)',
            '        :modal-strength undefined))',
        ].join('\n');
        expect(parenBalance(text)).toBe(0);

        const result = deleteAndGetResult(text, ':modal-strength', 1);
        expect(parenBalance(result)).toBe(0);
    });
});
