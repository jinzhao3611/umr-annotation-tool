/**
 * Alignment Generator - auto-generates alignments for sentence-level annotation.
 *
 * generateAlignments()        - button click handler
 * showDisambiguationModal()   - interactive disambiguation for ambiguous matches
 * showAlignmentNotification() - toast summary of results
 */

function generateAlignments() {
    const btn = document.getElementById('generate-alignments-btn');
    if (!btn) return;

    // Disable button while processing
    btn.disabled = true;
    btn.textContent = 'Generating...';

    // Extract tokens from sentence display (strip superscript index text)
    const tokens = [];
    document.querySelectorAll('#sentence-display .token').forEach(span => {
        // The token HTML is: <sup class="token-index">N</sup>tokenText
        // We want just the token text, not the superscript index
        const clone = span.cloneNode(true);
        const sup = clone.querySelector('.token-index');
        if (sup) sup.remove();
        const text = clone.textContent.trim();
        if (text) tokens.push(text);
    });

    if (tokens.length === 0) {
        alert('No tokens found in the sentence display.');
        btn.disabled = false;
        btn.innerHTML = '&#9881; Generate Alignments';
        return;
    }

    // Get graph text - prefer text editor if visible, else graph view
    let graphText = '';
    const textEditor = document.getElementById('umr-text-editor');
    const textEditorContainer = document.getElementById('text-editor-container');
    if (textEditor && textEditorContainer && textEditorContainer.style.display !== 'none') {
        graphText = textEditor.value;
    } else {
        const amrPre = document.querySelector('#amr pre');
        if (amrPre) {
            graphText = amrPre.textContent;
        }
    }

    if (!graphText.trim()) {
        alert('No graph annotation found. Please create an annotation first.');
        btn.disabled = false;
        btn.innerHTML = '&#9881; Generate Alignments';
        return;
    }

    // POST to API
    fetch('/api/generate_alignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            graph_text: graphText,
            tokens: tokens,
            existing_alignments: currentAlignments
        })
    })
    .then(response => response.json())
    .then(data => {
        btn.disabled = false;
        btn.innerHTML = '&#9881; Generate Alignments';

        if (!data.success) {
            alert('Error generating alignments: ' + (data.error || 'Unknown error'));
            return;
        }

        // Auto-apply confident results
        let autoCount = 0;
        for (const [varName, alignment] of Object.entries(data.confident || {})) {
            if (!currentAlignments[varName]) {
                currentAlignments[varName] = [];
            }
            if (!currentAlignments[varName].includes(alignment)) {
                currentAlignments[varName].push(alignment);
                autoCount++;
            }
        }

        if (autoCount > 0) {
            saveAlignments();
            renderAlignments();
        }

        // If there are ambiguous matches, open disambiguation modal
        const ambiguous = data.ambiguous || {};
        if (Object.keys(ambiguous).length > 0) {
            showDisambiguationModal(ambiguous, tokens, {
                autoAssigned: autoCount,
                noMatch: (data.no_match || []).length,
                skipped: data.skipped_count || 0
            });
        } else {
            // No ambiguous - show summary directly
            showAlignmentNotification({
                autoAssigned: autoCount,
                manualResolved: 0,
                noMatch: (data.no_match || []).length,
                skipped: data.skipped_count || 0
            });
        }
    })
    .catch(err => {
        btn.disabled = false;
        btn.innerHTML = '&#9881; Generate Alignments';
        console.error('Error generating alignments:', err);
        alert('Network error generating alignments.');
    });
}


function showDisambiguationModal(ambiguous, tokens, partialCounts) {
    const entries = Object.entries(ambiguous);
    let currentIndex = 0;
    const selections = {}; // var -> Set of selected token indices (1-based)

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.id = 'disambiguation-modal-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;'
        + 'background:rgba(0,0,0,0.6);z-index:10000;display:flex;'
        + 'align-items:center;justify-content:center;';

    const modal = document.createElement('div');
    modal.style.cssText = 'background:white;border-radius:12px;padding:24px;'
        + 'max-width:700px;width:90%;max-height:80vh;overflow-y:auto;'
        + 'box-shadow:0 8px 32px rgba(0,0,0,0.3);';

    overlay.appendChild(modal);

    function renderStep() {
        const [varName, info] = entries[currentIndex];
        const concept = info.concept || varName;
        const candidates = info.candidates || [];

        let html = '<div style="margin-bottom:16px;">'
            + '<h5 style="margin:0 0 4px 0;">Disambiguate Alignment</h5>'
            + '<small style="color:#6c757d;">Step ' + (currentIndex + 1) + ' of ' + entries.length + '</small>'
            + '</div>';

        html += '<div style="margin-bottom:12px;">'
            + '<span class="badge bg-primary" style="font-size:0.95rem;margin-right:8px;">' + varName + '</span>'
            + '<span style="color:#495057;font-weight:500;">' + concept + '</span>'
            + '</div>';

        html += '<p style="margin-bottom:8px;color:#6c757d;font-size:0.9rem;">'
            + 'Click the correct token(s) for this concept (click again to deselect):</p>';

        // Render sentence with candidates highlighted
        const selected = selections[varName] || new Set();
        html += '<div style="line-height:2.5;padding:12px;background:#f8f9fa;border-radius:8px;margin-bottom:16px;">';
        tokens.forEach((tok, i) => {
            const tokIdx = i + 1; // 1-based
            const isCandidate = candidates.includes(tokIdx);
            const isSelected = selected.has(tokIdx);

            let style = 'display:inline-block;margin:2px 4px;padding:4px 8px;border-radius:4px;';
            if (isSelected) {
                style += 'background:#28a745;color:white;cursor:pointer;font-weight:600;';
            } else if (isCandidate) {
                style += 'background:#ffc107;color:#212529;cursor:pointer;font-weight:500;';
            } else {
                style += 'color:#6c757d;';
            }

            html += '<span class="disambig-token" data-tok-idx="' + tokIdx + '"'
                + ' data-is-candidate="' + isCandidate + '"'
                + ' style="' + style + '">'
                + '<sup style="font-size:0.7em;color:' + (isSelected ? '#fff' : '#999') + ';margin-right:2px;">' + tokIdx + '</sup>'
                + tok + '</span>';
        });
        html += '</div>';

        // Buttons
        html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        html += '<button id="disambig-skip" class="btn btn-sm btn-outline-secondary">Skip</button>';
        html += '<div>';
        if (currentIndex > 0) {
            html += '<button id="disambig-prev" class="btn btn-sm btn-outline-primary" style="margin-right:8px;">Previous</button>';
        }
        if (currentIndex < entries.length - 1) {
            html += '<button id="disambig-next" class="btn btn-sm btn-primary">Next</button>';
        } else {
            html += '<button id="disambig-finish" class="btn btn-sm btn-success">Finish</button>';
        }
        html += '</div></div>';

        modal.innerHTML = html;

        // Attach click handlers to candidate tokens
        modal.querySelectorAll('.disambig-token').forEach(el => {
            if (el.dataset.isCandidate === 'true') {
                el.addEventListener('click', function () {
                    const idx = parseInt(this.dataset.tokIdx);
                    if (!selections[varName]) selections[varName] = new Set();
                    if (selections[varName].has(idx)) {
                        selections[varName].delete(idx);
                    } else {
                        selections[varName].add(idx);
                    }
                    renderStep(); // Re-render to show selection
                });

                // Hover effect for candidates
                const sel = selections[varName] || new Set();
                el.addEventListener('mouseenter', function () {
                    if (!sel.has(parseInt(this.dataset.tokIdx))) {
                        this.style.background = '#ffdb4d';
                    }
                });
                el.addEventListener('mouseleave', function () {
                    const idx = parseInt(this.dataset.tokIdx);
                    if (sel.has(idx)) {
                        this.style.background = '#28a745';
                    } else {
                        this.style.background = '#ffc107';
                    }
                });
            }
        });

        // Button handlers
        const skipBtn = modal.querySelector('#disambig-skip');
        if (skipBtn) skipBtn.addEventListener('click', function () {
            selections[varName] = new Set();
            advance();
        });

        const prevBtn = modal.querySelector('#disambig-prev');
        if (prevBtn) prevBtn.addEventListener('click', function () {
            currentIndex--;
            renderStep();
        });

        const nextBtn = modal.querySelector('#disambig-next');
        if (nextBtn) nextBtn.addEventListener('click', advance);

        const finishBtn = modal.querySelector('#disambig-finish');
        if (finishBtn) finishBtn.addEventListener('click', finalize);
    }

    function advance() {
        if (currentIndex < entries.length - 1) {
            currentIndex++;
            renderStep();
        } else {
            finalize();
        }
    }

    function finalize() {
        // Apply selections to currentAlignments
        let manualCount = 0;
        for (const [varName, idxSet] of Object.entries(selections)) {
            if (!idxSet || idxSet.size === 0) continue;
            const sorted = Array.from(idxSet).sort((a, b) => a - b);
            const alignment = sorted[0] + '-' + sorted[sorted.length - 1];
            if (!currentAlignments[varName]) {
                currentAlignments[varName] = [];
            }
            if (!currentAlignments[varName].includes(alignment)) {
                currentAlignments[varName].push(alignment);
                manualCount++;
            }
        }

        if (manualCount > 0) {
            saveAlignments();
            renderAlignments();
        }

        // Remove modal
        overlay.remove();

        // Show summary
        showAlignmentNotification({
            autoAssigned: partialCounts.autoAssigned,
            manualResolved: manualCount,
            noMatch: partialCounts.noMatch,
            skipped: partialCounts.skipped
        });
    }

    document.body.appendChild(overlay);

    // Close on overlay background click
    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) {
            overlay.remove();
        }
    });

    renderStep();
}


function showAlignmentNotification(counts) {
    const notification = document.createElement('div');
    notification.style.cssText = 'position:fixed;top:20px;right:20px;z-index:10001;'
        + 'background:white;border-radius:8px;padding:16px 20px;'
        + 'box-shadow:0 4px 16px rgba(0,0,0,0.2);max-width:320px;'
        + 'border-left:4px solid #28a745;';

    let html = '<div style="font-weight:600;margin-bottom:8px;">Alignment Generation Complete</div>';
    html += '<div style="font-size:0.9rem;color:#495057;">';
    if (counts.autoAssigned > 0) {
        html += '<div>Auto-assigned: <strong>' + counts.autoAssigned + '</strong></div>';
    }
    if (counts.manualResolved > 0) {
        html += '<div>Manually resolved: <strong>' + counts.manualResolved + '</strong></div>';
    }
    if (counts.noMatch > 0) {
        html += '<div style="color:#6c757d;">No match: ' + counts.noMatch + '</div>';
    }
    if (counts.skipped > 0) {
        html += '<div style="color:#6c757d;">Already aligned: ' + counts.skipped + '</div>';
    }
    if (counts.autoAssigned === 0 && counts.manualResolved === 0) {
        html += '<div>No new alignments generated.</div>';
    }
    html += '</div>';

    notification.innerHTML = html;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.transition = 'opacity 0.5s';
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 500);
    }, 4000);
}
