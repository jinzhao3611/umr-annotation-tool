"""Tests for modal_converter.py — sentence-to-document modal conversion."""

import pytest
from umr_annot_tool.resources.utility_modules.modal_converter import (
    parse_sentence_annotation,
    find_conceiver,
    convert_modstr_to_relation,
    generate_modal_triples_for_sentence,
    generate_modal_triples_for_document,
    triples_to_json_list,
    extract_existing_modal_triples,
    strip_modal_annotations_from_penman,
)


# ── helpers ──────────────────────────────────────────────────────────────

def _triple_set(triples):
    """Convert list of ModalTriple to a set of (source, relation, target) for easy comparison."""
    return {(t.source, t.relation, t.target) for t in triples}


# ── Rule 1: Bare :modal-strength ─────────────────────────────────────────

class TestRule1BareModalStrength:
    """Event with only :modal-strength → (root :modal author), (author :<modstr> <event>)"""

    def test_single_event_full_affirmative(self):
        penman = """(s1e / eat-01
            :ARG0 (s1x / person :name (s1n / name :op1 "Mary"))
            :ARG1 (s1x2 / apple)
            :modal-strength full-affirmative)"""
        info = parse_sentence_annotation(penman, 1)
        triples = generate_modal_triples_for_sentence(info)
        ts = _triple_set(triples)
        assert ('root', ':modal', 'author') in ts
        assert ('author', ':full-affirmative', 's1e') in ts

    def test_single_event_partial_negative(self):
        penman = """(s1e / run-01
            :ARG0 (s1x / dog)
            :modal-strength partial-negative)"""
        info = parse_sentence_annotation(penman, 1)
        triples = generate_modal_triples_for_sentence(info)
        ts = _triple_set(triples)
        assert ('author', ':partial-negative', 's1e') in ts

    def test_multiple_bare_events(self):
        penman = """(s1e / and
            :op1 (s1e2 / run-01
                :ARG0 (s1x / boy)
                :modal-strength full-affirmative)
            :op2 (s1e3 / jump-01
                :ARG0 s1x
                :modal-strength neutral-affirmative))"""
        info = parse_sentence_annotation(penman, 1)
        triples = generate_modal_triples_for_sentence(info)
        ts = _triple_set(triples)
        assert ('author', ':full-affirmative', 's1e2') in ts
        assert ('author', ':neutral-affirmative', 's1e3') in ts


# ── Rule 2: :modal-predicate ─────────────────────────────────────────────

class TestRule2ModalPredicate:
    """E has :modal-predicate M → conceiver chain"""

    def test_think_modal_predicate(self):
        """'Mary thinks it will rain' → think has :modal-predicate rain"""
        penman = """(s1e / think-01
            :ARG0 (s1x / person :name (s1n / name :op1 "Mary"))
            :modal-predicate (s1e2 / rain-01)
            :modal-strength full-affirmative)"""
        info = parse_sentence_annotation(penman, 1)
        triples = generate_modal_triples_for_sentence(info)
        ts = _triple_set(triples)
        assert ('root', ':modal', 'author') in ts
        assert ('author', ':full-affirmative', 's1x') in ts
        assert ('s1x', ':full-affirmative', 's1e2') in ts

    def test_modal_predicate_no_conceiver(self):
        """When no ARG0/actor/experiencer is found, simpler structure."""
        penman = """(s1e / seem-01
            :modal-predicate (s1e2 / rain-01)
            :modal-strength full-affirmative)"""
        info = parse_sentence_annotation(penman, 1)
        triples = generate_modal_triples_for_sentence(info)
        ts = _triple_set(triples)
        assert ('root', ':modal', 'author') in ts
        assert ('author', ':full-affirmative', 's1e') in ts


# ── Rule 3: :quote ───────────────────────────────────────────────────────

class TestRule3Quote:
    """E has :quote S → speech/quotation structure"""

    def test_say_quote(self):
        """'John said it rained' → rain :quote say"""
        penman = """(s1e / rain-01
            :quote (s1e2 / say-01
                :ARG0 (s1x / person :name (s1n / name :op1 "John"))
                :modal-strength full-affirmative)
            :modal-strength full-affirmative)"""
        info = parse_sentence_annotation(penman, 1)
        triples = generate_modal_triples_for_sentence(info)
        ts = _triple_set(triples)
        assert ('root', ':modal', 'author') in ts
        assert ('author', ':full-affirmative', 's1e2') in ts
        assert ('author', ':full-affirmative', 's1x') in ts
        assert ('s1x', ':full-affirmative', 's1e') in ts


# ── Rule 4: :purpose ─────────────────────────────────────────────────────

class TestRule4Purpose:
    """M has :purpose E → purpose structure with partial-affirmative"""

    def test_purpose(self):
        """'He ran to catch the bus'"""
        penman = """(s1e / run-01
            :ARG0 (s1x / he)
            :purpose (s1e2 / catch-01
                :ARG0 s1x
                :ARG1 (s1x2 / bus)
                :modal-strength partial-affirmative)
            :modal-strength full-affirmative)"""
        info = parse_sentence_annotation(penman, 1)
        triples = generate_modal_triples_for_sentence(info)
        ts = _triple_set(triples)
        assert ('root', ':modal', 'author') in ts
        assert ('author', ':full-affirmative', 's1e') in ts
        assert ('s1x', ':partial-affirmative', 'purpose') in ts or \
               ('author', ':partial-affirmative', 'purpose') in ts
        assert ('purpose', ':full-affirmative', 's1e2') in ts


# ── Rule 5: :condition ───────────────────────────────────────────────────

class TestRule5Condition:
    """M has :condition C → condition structure"""

    def test_condition(self):
        """'If it rains, I'll stay home'"""
        penman = """(s1e / stay-01
            :ARG0 (s1x / i)
            :condition (s1e2 / rain-01
                :modal-strength neutral-affirmative)
            :modal-strength neutral-affirmative)"""
        info = parse_sentence_annotation(penman, 1)
        triples = generate_modal_triples_for_sentence(info)
        ts = _triple_set(triples)
        assert ('root', ':modal', 'author') in ts
        assert ('author', ':neutral-affirmative', 'have-condition') in ts
        assert ('have-condition', ':neutral-affirmative', 's1e2') in ts
        assert ('have-condition', ':neutral-affirmative', 's1e') in ts


# ── convert_modstr_to_relation ───────────────────────────────────────────

class TestConvertModstrToRelation:
    def test_known_values(self):
        assert convert_modstr_to_relation('full-affirmative') == ':full-affirmative'
        assert convert_modstr_to_relation('partial-negative') == ':partial-negative'
        assert convert_modstr_to_relation('neutral-affirmative') == ':neutral-affirmative'

    def test_abbreviations(self):
        assert convert_modstr_to_relation('Aff') == ':full-affirmative'
        assert convert_modstr_to_relation('Prt') == ':partial-affirmative'
        assert convert_modstr_to_relation('Neut') == ':neutral-affirmative'
        assert convert_modstr_to_relation('Neg') == ':full-negative'

    def test_case_insensitive(self):
        assert convert_modstr_to_relation('Full-Affirmative') == ':full-affirmative'
        assert convert_modstr_to_relation('FULL-AFFIRMATIVE') == ':full-affirmative'

    def test_empty_or_none(self):
        assert convert_modstr_to_relation('') == ':unspecified'
        assert convert_modstr_to_relation(None) == ':unspecified'

    def test_quoted_values(self):
        assert convert_modstr_to_relation('"full-affirmative"') == ':full-affirmative'


# ── Document-level generation ────────────────────────────────────────────

class TestDocumentLevel:
    def test_multi_sentence_deduplication(self):
        """(root :modal author) should appear only once across sentences."""
        annotations = {
            '1': """(s1e / eat-01
                :ARG0 (s1x / person)
                :modal-strength full-affirmative)""",
            '2': """(s2e / run-01
                :ARG0 (s2x / dog)
                :modal-strength partial-affirmative)"""
        }
        triples = generate_modal_triples_for_document(annotations)
        root_modal_count = sum(1 for t in triples
                               if t.source == 'root' and t.relation == ':modal' and t.target == 'author')
        assert root_modal_count == 1

    def test_triples_to_json_list(self):
        from umr_annot_tool.resources.utility_modules.modal_converter import ModalTriple
        triples = [ModalTriple('root', ':modal', 'author', True)]
        result = triples_to_json_list(triples)
        assert len(result) == 1
        assert result[0] == {
            'source': 'root',
            'relation': ':modal',
            'target': 'author',
            'auto_generated': True
        }


# ── extract_existing_modal_triples ───────────────────────────────────────

class TestExtractExistingTriples:
    def test_parse_modal_section(self):
        doc_annot = """(s0d / doc
            :temporal ((s1e :before DCT))
            :modal ((root :modal author) (author :full-affirmative s1e))
            :coref ((s1x :same-entity s2x)))"""
        triples = extract_existing_modal_triples(doc_annot)
        ts = _triple_set(triples)
        assert ('root', ':modal', 'author') in ts
        assert ('author', ':full-affirmative', 's1e') in ts
        assert len(triples) == 2

    def test_empty_input(self):
        assert extract_existing_modal_triples('') == []
        assert extract_existing_modal_triples(None) == []

    def test_no_modal_section(self):
        doc_annot = """(s0d / doc :temporal ((s1e :before DCT)))"""
        assert extract_existing_modal_triples(doc_annot) == []


# ── strip_modal_annotations_from_penman ──────────────────────────────────

class TestStripModalAnnotations:
    def test_strip_modal_strength(self):
        penman = """(s1e / eat-01
            :ARG0 (s1x / person)
            :modal-strength full-affirmative)"""
        result = strip_modal_annotations_from_penman(penman)
        assert ':modal-strength' not in result
        assert ':ARG0' in result
        assert 'eat-01' in result

    def test_strip_modal_predicate(self):
        penman = """(s1e / think-01
            :ARG0 (s1x / person)
            :modal-predicate s1e2
            :modal-strength full-affirmative)"""
        result = strip_modal_annotations_from_penman(penman)
        assert ':modal-predicate' not in result
        assert ':modal-strength' not in result

    def test_preserves_closing_parens(self):
        """Regression: regex should not eat closing parentheses."""
        penman = """(s1e / eat-01
            :ARG0 (s1x / person)
            :modal-strength full-affirmative)"""
        result = strip_modal_annotations_from_penman(penman)
        assert result.count('(') == result.count(')')

    def test_empty_input(self):
        assert strip_modal_annotations_from_penman('') == ''
        assert strip_modal_annotations_from_penman(None) is None
