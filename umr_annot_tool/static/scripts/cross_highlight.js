// Cross-highlight between UMR graph variable spans and source-sentence tokens.
// Hovering a .variable-span lights up the aligned .token spans, and vice versa.
// Reads alignments from the global currentAlignments dict populated by
// alignments_v2.js, which has the shape { "s1x": ["2-3"], "s2y": ["4-4", "6-6"] }.

(function () {
    const TOKEN_HL_CLASS = 'token-cross-highlight';
    const VAR_HL_CLASS = 'variable-cross-highlight';

    function getAlignments() {
        // alignments_v2.js declares `let currentAlignments` at top level, which
        // is reachable as a same-script-scope identifier. Fall back to window
        // in case a future change scopes it differently.
        try {
            return typeof currentAlignments !== 'undefined'
                ? currentAlignments
                : (window.currentAlignments || {});
        } catch (e) {
            return window.currentAlignments || {};
        }
    }

    // Parse a single range token like "2-3" → [2, 3]. Returns null for
    // unaligned sentinels ("0-0", "0", "") and malformed input.
    function parseSingleRange(piece) {
        if (!piece) return null;
        const trimmed = piece.trim();
        if (!trimmed) return null;
        const parts = trimmed.split('-').map(s => s.trim());
        let start, end;
        if (parts.length === 1) {
            start = end = parseInt(parts[0], 10);
        } else if (parts.length === 2) {
            start = parseInt(parts[0], 10);
            end = parseInt(parts[1], 10);
        } else {
            return null;
        }
        if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
        if (start <= 0 || end <= 0) return null;  // 0-0 sentinel — unaligned
        if (end < start) return null;
        return [start, end];
    }

    // Expand alignment values (a list like ["2-3"] or a single string
    // possibly containing comma-separated pieces "2-3, 5-5") into a flat
    // array of integer token indices.
    function tokenIndicesForValues(values) {
        if (!values) return [];
        const list = Array.isArray(values) ? values : [values];
        const indices = [];
        for (const v of list) {
            if (v == null) continue;
            const pieces = String(v).split(',');
            for (const piece of pieces) {
                const range = parseSingleRange(piece);
                if (!range) continue;
                for (let i = range[0]; i <= range[1]; i++) {
                    indices.push(i);
                }
            }
        }
        return indices;
    }

    function tokenIndicesForVar(varName) {
        return tokenIndicesForValues(getAlignments()[varName]);
    }

    function varsForTokenIndex(tokenIdx) {
        const aligns = getAlignments();
        const result = [];
        for (const varName of Object.keys(aligns)) {
            const indices = tokenIndicesForValues(aligns[varName]);
            if (indices.includes(tokenIdx)) result.push(varName);
        }
        return result;
    }

    function clearTokenHighlights() {
        document.querySelectorAll('.' + TOKEN_HL_CLASS)
            .forEach(el => el.classList.remove(TOKEN_HL_CLASS));
    }

    function clearVarHighlights() {
        document.querySelectorAll('.' + VAR_HL_CLASS)
            .forEach(el => el.classList.remove(VAR_HL_CLASS));
    }

    function highlightTokens(indices) {
        if (!indices || indices.length === 0) return;
        const sentenceRoot = document.getElementById('sentence-display') || document;
        for (const idx of indices) {
            sentenceRoot.querySelectorAll(`.token[data-index="${idx}"]`)
                .forEach(el => el.classList.add(TOKEN_HL_CLASS));
        }
    }

    function highlightVars(varNames) {
        if (!varNames || varNames.length === 0) return;
        for (const name of varNames) {
            // CSS attribute selector — escape only minimal cases. Variable
            // names in UMR are alphanumeric (s1x, s12a3) so a plain string
            // works without escaping.
            document.querySelectorAll(`.variable-span[data-variable="${name}"]`)
                .forEach(el => el.classList.add(VAR_HL_CLASS));
        }
    }

    // Public: bind hover handlers on a single variable span. Called from
    // updateVariableSpans() in relation_editor.js after each graph re-render
    // (since spans are cloned/replaced on every refresh).
    function bindVariableSpan(span) {
        if (!span || span.dataset.crossHighlightBound === '1') return;
        span.dataset.crossHighlightBound = '1';
        span.addEventListener('mouseenter', () => {
            const varName = span.getAttribute('data-variable') || span.textContent;
            if (!varName) return;
            highlightTokens(tokenIndicesForVar(varName));
            // Also highlight other instances of the same variable in the graph
            // (reentrancy). The hovered span itself ends up in the set too.
            highlightVars([varName]);
        });
        span.addEventListener('mouseleave', () => {
            clearTokenHighlights();
            clearVarHighlights();
        });
    }

    // Public: bind hover handlers on each .token span. Tokens are not
    // re-rendered after page load, so a single bind on init is enough.
    function bindAllTokens() {
        const tokens = document.querySelectorAll('#sentence-display .token');
        tokens.forEach(token => {
            if (token.dataset.crossHighlightBound === '1') return;
            token.dataset.crossHighlightBound = '1';
            token.addEventListener('mouseenter', () => {
                const idx = parseInt(token.getAttribute('data-index'), 10);
                if (!Number.isFinite(idx)) return;
                highlightVars(varsForTokenIndex(idx));
                highlightTokens([idx]);
            });
            token.addEventListener('mouseleave', () => {
                clearTokenHighlights();
                clearVarHighlights();
            });
        });
    }

    // Bind any variable spans that are already in the DOM. Future re-renders
    // call window.crossHighlight.bindVariableSpan directly from
    // relation_editor.js, so this catches the initial render only.
    function bindAllVariableSpans() {
        document.querySelectorAll('.variable-span').forEach(bindVariableSpan);
    }

    function init() {
        bindAllTokens();
        bindAllVariableSpans();
    }

    window.crossHighlight = {
        init,
        bindVariableSpan,
        bindAllVariableSpans,
        bindAllTokens,
        // Exposed for testing / future reuse:
        tokenIndicesForVar,
        varsForTokenIndex,
    };
})();
