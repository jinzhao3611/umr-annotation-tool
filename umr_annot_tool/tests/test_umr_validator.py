import unittest
from umr_annot_tool.umr_validator import normalize_attribute_case


class TestNormalizeAttributeCase(unittest.TestCase):
    """Tests for normalize_attribute_case, focusing on modal-strength value normalization."""

    # --- Abbreviation expansion ---

    def test_expand_abbreviated_modstr(self):
        self.assertIn(':modal-strength', normalize_attribute_case(':MODSTR full-affirmative'))
        self.assertIn(':modal-strength', normalize_attribute_case(':modstr full-affirmative'))

    def test_expand_fullAff(self):
        result = normalize_attribute_case(':modal-strength FullAff')
        self.assertIn('full-affirmative', result)

    def test_expand_neutAff(self):
        result = normalize_attribute_case(':modal-strength NeutAff')
        self.assertIn('neutral-affirmative', result)

    def test_expand_neutDisaff(self):
        result = normalize_attribute_case(':modal-strength NeutDisaff')
        self.assertIn('neutral-negative', result)

    def test_expand_fullDisaff(self):
        result = normalize_attribute_case(':modal-strength FullDisaff')
        self.assertIn('full-negative', result)

    def test_expand_disaff(self):
        result = normalize_attribute_case(':modal-strength Disaff')
        self.assertIn('partial-negative', result)

    def test_expand_aff(self):
        result = normalize_attribute_case(':modal-strength Aff')
        self.assertIn('partial-affirmative', result)

    def test_expand_neutral_standalone(self):
        result = normalize_attribute_case(':modal-strength Neutral')
        self.assertIn('neutral-affirmative', result)

    # --- Idempotency: already-expanded values must not be corrupted ---

    def test_neutral_affirmative_idempotent(self):
        """Regression: neutral-affirmative must not become neutral-affirmative-affirmative."""
        text = ':modal-strength neutral-affirmative'
        self.assertEqual(normalize_attribute_case(text), text)

    def test_neutral_negative_idempotent(self):
        text = ':modal-strength neutral-negative'
        self.assertEqual(normalize_attribute_case(text), text)

    def test_full_affirmative_idempotent(self):
        text = ':modal-strength full-affirmative'
        self.assertEqual(normalize_attribute_case(text), text)

    def test_full_negative_idempotent(self):
        text = ':modal-strength full-negative'
        self.assertEqual(normalize_attribute_case(text), text)

    def test_partial_affirmative_idempotent(self):
        text = ':modal-strength partial-affirmative'
        self.assertEqual(normalize_attribute_case(text), text)

    def test_partial_negative_idempotent(self):
        text = ':modal-strength partial-negative'
        self.assertEqual(normalize_attribute_case(text), text)

    def test_repeated_normalization_stable(self):
        """Applying normalization multiple times must not keep appending fragments."""
        text = ':modal-strength neutral-affirmative'
        for _ in range(5):
            text = normalize_attribute_case(text)
        self.assertEqual(text, ':modal-strength neutral-affirmative')

    # --- Full annotation context ---

    def test_neutral_affirmative_in_full_annotation(self):
        annotation = (
            '(s7x1 / 摘-02\n'
            '    :polarity umr-unknown\n'
            '    :mode interrogative\n'
            '    :aspect state\n'
            '    :modal-strength neutral-affirmative\n'
            '    :ARG0 (s7x / 心理学家))'
        )
        result = normalize_attribute_case(annotation)
        self.assertIn(':modal-strength neutral-affirmative\n', result)
        self.assertNotIn('neutral-affirmative-affirmative', result)


if __name__ == '__main__':
    unittest.main()
