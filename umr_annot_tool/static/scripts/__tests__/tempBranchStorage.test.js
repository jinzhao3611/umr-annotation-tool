/**
 * @jest-environment jsdom
 */

const { extractNodes, extractBranchFromRelation } = require('../tempBranchStorage');

// ---------------------------------------------------------------------------
// Bug 1 – extractNodes must capture ALL variable/concept pairs per line
// ---------------------------------------------------------------------------
describe('extractNodes', () => {
    test('extracts a single node from a simple annotation', () => {
        const text = '(s1 / say-01)';
        const nodes = extractNodes(text);
        expect(nodes).toHaveLength(1);
        expect(nodes[0]).toMatchObject({ variable: 's1', concept: 'say-01' });
    });

    test('extracts nodes across multiple lines', () => {
        const text = [
            '(s1 / say-01',
            '    :ARG0 (s2 / person)',
            '    :ARG1 (s3 / thing))'
        ].join('\n');
        const nodes = extractNodes(text);
        expect(nodes).toHaveLength(3);
        expect(nodes.map(n => n.variable)).toEqual(['s1', 's2', 's3']);
    });

    test('extracts multiple nodes on the SAME line', () => {
        // This is the core Bug 1 scenario: two variable/concept pairs on one line
        const text = '    :ARG0 (s2 / person :ARG1-of (s3 / work-01))';
        const nodes = extractNodes(text);
        expect(nodes).toHaveLength(2);
        expect(nodes[0]).toMatchObject({ variable: 's2', concept: 'person' });
        expect(nodes[1]).toMatchObject({ variable: 's3', concept: 'work-01' });
    });

    test('extracts three nodes on the same line', () => {
        const text = '(s1 / say-01 :ARG0 (s2 / person :name (s3 / name)))';
        const nodes = extractNodes(text);
        expect(nodes).toHaveLength(3);
        expect(nodes.map(n => n.variable)).toEqual(['s1', 's2', 's3']);
    });

    test('deduplicates nodes with the same variable', () => {
        // If the same variable appears twice (e.g., via re-entrancy notation),
        // only the first occurrence should be kept
        const text = [
            '(s1 / say-01',
            '    :ARG0 (s2 / person)',
            '    :ARG1 (s2 / person))'
        ].join('\n');
        const nodes = extractNodes(text);
        expect(nodes).toHaveLength(2); // s1 + s2 (deduplicated)
        expect(nodes.map(n => n.variable)).toEqual(['s1', 's2']);
    });

    test('handles complex multi-line annotation', () => {
        const text = [
            '(s1 / obligate-01',
            '    :ARG1 (s1x / cross-02',
            '        :ARG0 (s2 / person',
            '            :ARG0-of (s3 / have-org-role-91',
            '                :ARG2 (s4 / president)))',
            '        :ARG1 (s5 / border)))',
        ].join('\n');
        const nodes = extractNodes(text);
        expect(nodes.map(n => n.variable)).toEqual(['s1', 's1x', 's2', 's3', 's4', 's5']);
    });

    test('returns empty array for text with no nodes', () => {
        const nodes = extractNodes('no annotation here');
        expect(nodes).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// Bug 2 – extractBranchFromRelation must pick the correct line via DOM offset
// ---------------------------------------------------------------------------
describe('extractBranchFromRelation', () => {
    // Helper: build a <pre> element with relation spans wrapping `:relation` text.
    // We reproduce the structure that the annotation editor creates in the DOM.
    function buildAnnotationElement(annotationText) {
        const pre = document.createElement('pre');

        // Walk through the text and wrap every occurrence of a relation
        // (":SomeRelation") in a <span class="relation-span">.
        const relationPattern = /(:[A-Za-z0-9-]+)/g;
        let lastIndex = 0;
        let match;
        while ((match = relationPattern.exec(annotationText)) !== null) {
            // Text before the relation
            if (match.index > lastIndex) {
                pre.appendChild(document.createTextNode(annotationText.slice(lastIndex, match.index)));
            }
            // The relation span
            const span = document.createElement('span');
            span.className = 'relation-span';
            span.textContent = match[1];
            pre.appendChild(span);
            lastIndex = match.index + match[1].length;
        }
        // Remaining text
        if (lastIndex < annotationText.length) {
            pre.appendChild(document.createTextNode(annotationText.slice(lastIndex)));
        }
        return pre;
    }

    // The function needs `document.querySelector('#amr pre')` and
    // `showNotification` to exist globally.
    beforeEach(() => {
        // Clean up any previous DOM
        document.body.innerHTML = '';
        // showNotification is already defined in the module we required, but
        // in case it tries to touch DOM we make sure it doesn't throw.
        global.showNotification = jest.fn();
    });

    test('extracts the correct branch when there are duplicate relation names', () => {
        // Two :ARG0 relations at different nesting levels
        const text = [
            '(s1 / say-01',
            '    :ARG0 (s2 / person)',
            '    :ARG1 (s3 / thing',
            '        :ARG0 (s4 / dog)))'
        ].join('\n');

        const pre = buildAnnotationElement(text);
        document.body.appendChild(pre);

        // Get all relation spans — there are 3: :ARG0, :ARG1, :ARG0
        const spans = pre.querySelectorAll('.relation-span');
        const arg0Spans = Array.from(spans).filter(s => s.textContent === ':ARG0');
        expect(arg0Spans).toHaveLength(2);

        // Click the SECOND :ARG0 (line 4, before s4/dog)
        const result = extractBranchFromRelation(arg0Spans[1], pre);
        expect(result).not.toBeNull();
        expect(result.branchText).toContain(':ARG0');
        expect(result.branchText).toContain('s4');
        expect(result.branchText).toContain('dog');
        // It should NOT contain s2/person (that's the first :ARG0's branch)
        expect(result.branchText).not.toContain('person');
    });

    test('extracts the first branch correctly', () => {
        const text = [
            '(s1 / say-01',
            '    :ARG0 (s2 / person)',
            '    :ARG1 (s3 / thing))'
        ].join('\n');

        const pre = buildAnnotationElement(text);
        document.body.appendChild(pre);

        const spans = pre.querySelectorAll('.relation-span');
        // First span is :ARG0
        const result = extractBranchFromRelation(spans[0], pre);
        expect(result).not.toBeNull();
        expect(result.branchText).toContain(':ARG0');
        expect(result.branchText).toContain('person');
        expect(result.branchText).not.toContain('thing');
    });

    test('extracts a deeply nested branch', () => {
        const text = [
            '(s1 / obligate-01',
            '    :ARG1 (s2 / cross-02',
            '        :ARG0 (s3 / person',
            '            :ARG0-of (s4 / have-org-role-91',
            '                :ARG2 (s5 / president)))',
            '        :ARG1 (s6 / border)))',
        ].join('\n');

        const pre = buildAnnotationElement(text);
        document.body.appendChild(pre);

        const spans = Array.from(pre.querySelectorAll('.relation-span'));
        // Find the :ARG0-of span
        const arg0ofSpan = spans.find(s => s.textContent === ':ARG0-of');
        expect(arg0ofSpan).toBeDefined();

        const result = extractBranchFromRelation(arg0ofSpan, pre);
        expect(result).not.toBeNull();
        expect(result.branchText).toContain(':ARG0-of');
        expect(result.branchText).toContain('have-org-role-91');
        expect(result.branchText).toContain('president');
        // Should NOT include the sibling :ARG1 branch
        expect(result.branchText).not.toContain('border');
    });

    test('returns null for a span with invalid relation text', () => {
        const pre = document.createElement('pre');
        const span = document.createElement('span');
        span.className = 'relation-span';
        span.textContent = 'not-a-relation'; // missing leading ":"
        pre.appendChild(span);

        const result = extractBranchFromRelation(span, pre);
        expect(result).toBeNull();
    });
});
