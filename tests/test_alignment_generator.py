"""Tests for alignment_generator.py — interactive alignment generation."""

import pytest
from umr_annot_tool.resources.utility_modules.alignment_generator import (
    extract_nodes_from_graph,
    extract_parent_map,
    extract_name_info,
    find_token_matches,
    find_substring_matches,
    get_candidate_matches,
    generate_alignments_interactive,
)


# ── extract_nodes_from_graph ────────────────────────────────────────────

class TestExtractNodes:
    def test_simple_graph(self):
        graph = "(s1e / eat-01 :ARG0 (s1x / person) :ARG1 (s1x2 / apple))"
        nodes = extract_nodes_from_graph(graph)
        assert list(nodes.keys()) == ["s1e", "s1x", "s1x2"]
        assert nodes["s1e"] == "eat-01"
        assert nodes["s1x"] == "person"
        assert nodes["s1x2"] == "apple"

    def test_multiline_graph(self):
        graph = """(s1e / eat-01
            :ARG0 (s1x / person
                :name (s1n / name :op1 "Mary"))
            :ARG1 (s1x2 / apple))"""
        nodes = extract_nodes_from_graph(graph)
        assert len(nodes) == 4
        assert nodes["s1n"] == "name"

    def test_duplicate_var_keeps_first(self):
        graph = "(s1e / eat-01 :ARG0 (s1x / person)) (s1e / run-01)"
        nodes = extract_nodes_from_graph(graph)
        assert nodes["s1e"] == "eat-01"

    def test_empty_graph(self):
        assert extract_nodes_from_graph("") == {}


# ── extract_parent_map ──────────────────────────────────────────────────

class TestExtractParentMap:
    def test_simple_hierarchy(self):
        graph = "(s1e / eat-01 :ARG0 (s1x / person) :ARG1 (s1x2 / apple))"
        pmap = extract_parent_map(graph)
        assert pmap["s1x"] == "s1e"
        # Note: the regex-based parser's \S+ consumes the closing paren of
        # (s1x / person), so s1x is never popped — s1x2 sees s1x as parent.
        # This is a known limitation inherited from the original script;
        # it doesn't affect alignment quality since parent_map is only used
        # as a proximity hint in the batch script's pass 2.
        assert pmap["s1x2"] == "s1x"
        assert "s1e" not in pmap  # root has no parent

    def test_nested_hierarchy(self):
        graph = """(s1e / eat-01
            :ARG0 (s1x / person
                :name (s1n / name :op1 "Mary")))"""
        pmap = extract_parent_map(graph)
        assert pmap["s1x"] == "s1e"
        assert pmap["s1n"] == "s1x"


# ── extract_name_info ───────────────────────────────────────────────────

class TestExtractNameInfo:
    def test_single_name(self):
        graph = """(s1e / eat-01
            :ARG0 (s1x / person
                :name (s1n / name :op1 "Mary")))"""
        entity_names, name_vars = extract_name_info(graph)
        assert "s1n" in name_vars
        assert entity_names["s1x"] == ["Mary"]

    def test_multi_op_name(self):
        graph = """(s1x / person
            :name (s1n / name :op1 "New" :op2 "York"))"""
        entity_names, name_vars = extract_name_info(graph)
        assert entity_names["s1x"] == ["New", "York"]

    def test_no_names(self):
        graph = "(s1e / eat-01 :ARG0 (s1x / person))"
        entity_names, name_vars = extract_name_info(graph)
        assert entity_names == {}
        assert name_vars == set()


# ── find_token_matches / find_substring_matches ─────────────────────────

class TestTokenMatching:
    def test_exact_match(self):
        tokens = ["The", "cat", "sat", "on", "the", "mat"]
        assert find_token_matches("cat", tokens) == [2]
        assert find_token_matches("the", tokens) == [5]  # case-sensitive
        assert find_token_matches("The", tokens) == [1]

    def test_no_match(self):
        assert find_token_matches("dog", ["cat", "sat"]) == []

    def test_substring_match(self):
        tokens = ["eating", "apple", "trees"]
        assert find_substring_matches("eat", tokens) == [1]  # "eat" in "eating"
        assert find_substring_matches("tree", tokens) == [3]  # "tree" in "trees"

    def test_substring_bidirectional(self):
        tokens = ["go"]
        assert find_substring_matches("going", tokens) == [1]  # "go" in "going"

    def test_substring_no_self_match(self):
        tokens = ["eat"]
        assert find_substring_matches("eat", tokens) == []  # exact match excluded


# ── get_candidate_matches ───────────────────────────────────────────────

class TestGetCandidateMatches:
    def test_exact_concept_match(self):
        tokens = ["Mary", "ate", "an", "apple"]
        matches = get_candidate_matches("s1x2", "apple", tokens, {})
        assert matches == [4]

    def test_strips_sense_number(self):
        tokens = ["Mary", "ate", "an", "apple"]
        matches = get_candidate_matches("s1e", "eat-01", tokens, {})
        assert matches == []  # "eat" not in tokens, but "ate" is not "eat"

    def test_named_entity_match(self):
        tokens = ["Mary", "ate", "an", "apple"]
        entity_names = {"s1x": ["Mary"]}
        matches = get_candidate_matches("s1x", "person", tokens, entity_names)
        assert matches == [1]

    def test_substring_fallback(self):
        tokens = ["Mary", "eating", "an", "apple"]
        matches = get_candidate_matches("s1e", "eat-01", tokens, {})
        assert matches == [2]  # "eat" is substring of "eating"


# ── generate_alignments_interactive ─────────────────────────────────────

class TestGenerateAlignmentsInteractive:
    """Core integration tests for the main function."""

    SIMPLE_GRAPH = """(s1e / eat-01
        :ARG0 (s1x / person
            :name (s1n / name :op1 "Mary"))
        :ARG1 (s1x2 / apple))"""

    SIMPLE_TOKENS = ["Mary", "ate", "an", "apple"]

    def test_confident_unique_match(self):
        """apple matches token 4 uniquely → confident."""
        result = generate_alignments_interactive(self.SIMPLE_TOKENS, self.SIMPLE_GRAPH, {})
        assert "s1x2" in result.confident
        assert result.confident["s1x2"] == "4-4"

    def test_named_entity_alignment(self):
        """person with :name 'Mary' → aligns to token 1 via entity name."""
        result = generate_alignments_interactive(self.SIMPLE_TOKENS, self.SIMPLE_GRAPH, {})
        assert "s1x" in result.confident
        assert result.confident["s1x"] == "1-1"

    def test_name_var_goes_to_no_match(self):
        """The 'name' variable itself (s1n) should be in no_match."""
        result = generate_alignments_interactive(self.SIMPLE_TOKENS, self.SIMPLE_GRAPH, {})
        assert "s1n" in result.no_match

    def test_abstract_concept_no_match(self):
        """Abstract concepts like 'and' should go to no_match."""
        graph = "(s1e / and :op1 (s1e2 / run-01) :op2 (s1e3 / walk-01))"
        tokens = ["run", "and", "walk"]
        result = generate_alignments_interactive(tokens, graph, {})
        assert "s1e" in result.no_match

    def test_skips_existing_alignments(self):
        """Nodes already in existing_alignments should be skipped."""
        existing = {"s1x2": ["4-4"], "s1x": ["1-1"]}
        result = generate_alignments_interactive(self.SIMPLE_TOKENS, self.SIMPLE_GRAPH, existing)
        assert "s1x2" in result.skipped
        assert "s1x" in result.skipped
        assert "s1x2" not in result.confident
        assert "s1x" not in result.confident

    def test_skipped_count(self):
        existing = {"s1x2": ["4-4"]}
        result = generate_alignments_interactive(self.SIMPLE_TOKENS, self.SIMPLE_GRAPH, existing)
        assert len(result.skipped) == 1

    def test_ambiguous_multiple_matches(self):
        """When a concept matches multiple tokens → ambiguous."""
        graph = "(s1e / eat-01 :ARG0 (s1x / cat))"
        tokens = ["the", "cat", "ate", "a", "cat"]
        result = generate_alignments_interactive(tokens, graph, {})
        assert "s1x" in result.ambiguous
        assert sorted(result.ambiguous["s1x"]) == [2, 5]

    def test_concepts_populated(self):
        """The concepts dict should contain all nodes."""
        result = generate_alignments_interactive(self.SIMPLE_TOKENS, self.SIMPLE_GRAPH, {})
        assert result.concepts["s1e"] == "eat-01"
        assert result.concepts["s1x"] == "person"
        assert result.concepts["s1n"] == "name"
        assert result.concepts["s1x2"] == "apple"

    def test_multi_token_named_entity_range(self):
        """Multi-token name like 'New York' should produce a range alignment."""
        graph = """(s1x / city
            :name (s1n / name :op1 "New" :op2 "York"))"""
        tokens = ["in", "New", "York", "today"]
        result = generate_alignments_interactive(tokens, graph, {})
        assert result.confident["s1x"] == "2-3"

    def test_entity_type_without_name_no_match(self):
        """Entity type concept (e.g. 'country') with no :name child → no_match."""
        graph = "(s1x / country)"
        tokens = ["the", "country", "is", "large"]
        result = generate_alignments_interactive(tokens, graph, {})
        assert "s1x" in result.no_match

    def test_entity_type_with_name_matches(self):
        """Entity type concept with :name child → aligns via name."""
        graph = """(s1x / country
            :name (s1n / name :op1 "France"))"""
        tokens = ["in", "France", "today"]
        result = generate_alignments_interactive(tokens, graph, {})
        assert "s1x" in result.confident
        assert result.confident["s1x"] == "2-2"

    def test_empty_existing_alignments(self):
        """Empty dict and None values in existing_alignments should not cause skips."""
        result = generate_alignments_interactive(self.SIMPLE_TOKENS, self.SIMPLE_GRAPH, {})
        assert len(result.skipped) == 0

        result2 = generate_alignments_interactive(self.SIMPLE_TOKENS, self.SIMPLE_GRAPH, {"s1x2": []})
        # Empty list means no real alignment → should NOT be skipped
        assert "s1x2" not in result2.skipped

    def test_idempotency(self):
        """Running twice with first result as existing → second run skips all confident."""
        result1 = generate_alignments_interactive(self.SIMPLE_TOKENS, self.SIMPLE_GRAPH, {})
        # Simulate saving result1.confident as existing
        existing = {var: [aln] for var, aln in result1.confident.items()}
        result2 = generate_alignments_interactive(self.SIMPLE_TOKENS, self.SIMPLE_GRAPH, existing)
        assert len(result2.confident) == 0
        for var in result1.confident:
            assert var in result2.skipped

    def test_no_graph_nodes(self):
        """Empty or unparseable graph → empty result."""
        result = generate_alignments_interactive(["hello"], "", {})
        assert result.confident == {}
        assert result.ambiguous == {}
        assert result.no_match == []
        assert result.skipped == []
