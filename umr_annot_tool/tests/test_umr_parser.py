import unittest
from umr_annot_tool.main.umr_parser import parse_umr_file

class TestUMRParser(unittest.TestCase):
    def test_basic_parsing(self):
        """Test basic parsing of a simple UMR file with one sentence."""
        test_input = '''################################################################################
# meta-info :: sent_id = u_tree-cs-s1-root
# :: snt1	  200 dead , 1,500 feared missing in Philippines landslide .
Index: 1   2    3 4     5      6       7  8           9         10
Words: 200 dead , 1,500 feared missing in Philippines landslide . 

# sentence level graph:
(s1p / publication-91
    :ARG1 (s1l / landslide-01))

# alignment:
s1p: 0-0
s1l: 9-9

# document level annotation:
(s1s0 / sentence
    :temporal ((document-creation-time :before s1l)))
################################################################################'''

        content, sentences, sent_annotations, doc_annotations, alignments = parse_umr_file(test_input)
        
        # Test content is preserved
        self.assertEqual(content, test_input)
        
        # Test sentence parsing
        self.assertEqual(len(sentences), 1)
        expected_sentence = ['200', 'dead', ',', '1,500', 'feared', 'missing', 'in', 'Philippines', 'landslide', '.']
        self.assertEqual(sentences[0], expected_sentence)
        
        # Test sentence annotation parsing
        self.assertEqual(len(sent_annotations), 1)
        expected_sent_annot = '(s1p / publication-91\n    :ARG1 (s1l / landslide-01))'
        self.assertEqual(sent_annotations[0].strip(), expected_sent_annot)
        
        # Test document annotation parsing
        self.assertEqual(len(doc_annotations), 1)
        expected_doc_annot = '(s1s0 / sentence\n    :temporal ((document-creation-time :before s1l)))'
        self.assertEqual(doc_annotations[0].strip(), expected_doc_annot)
        
        # Test alignment parsing
        self.assertEqual(len(alignments), 1)
        expected_alignment = {'s1p': ['0-0'], 's1l': ['9-9']}
        self.assertEqual(alignments[0], expected_alignment)

    def test_multiple_sentences(self):
        """Test parsing of multiple sentences in a UMR file."""
        test_input = '''################################################################################
# meta-info :: sent_id = u_tree-cs-s1-root
# :: snt1	  First sentence .
Index: 1     2         3
Words: First sentence .

# sentence level graph:
(s1 / sentence-01)

# alignment:
s1: 0-0

# document level annotation:
(d1 / doc-01)

################################################################################
# meta-info :: sent_id = u_tree-cs-s2-root
# :: snt2	  Second sentence .
Index: 1      2         3
Words: Second sentence .

# sentence level graph:
(s2 / sentence-02)

# alignment:
s2: 0-0

# document level annotation:
(d2 / doc-02)
################################################################################'''

        content, sentences, sent_annotations, doc_annotations, alignments = parse_umr_file(test_input)
        
        # Test multiple sentence parsing
        self.assertEqual(len(sentences), 2)
        self.assertEqual(sentences[0], ['First', 'sentence', '.'])
        self.assertEqual(sentences[1], ['Second', 'sentence', '.'])
        
        # Test multiple annotations
        self.assertEqual(len(sent_annotations), 2)
        self.assertEqual(sent_annotations[0].strip(), '(s1 / sentence-01)')
        self.assertEqual(sent_annotations[1].strip(), '(s2 / sentence-02)')
        
        # Test multiple document annotations
        self.assertEqual(len(doc_annotations), 2)
        self.assertEqual(doc_annotations[0].strip(), '(d1 / doc-01)')
        self.assertEqual(doc_annotations[1].strip(), '(d2 / doc-02)')
        
        # Test multiple alignments
        self.assertEqual(len(alignments), 2)
        self.assertEqual(alignments[0], {'s1': ['0-0']})
        self.assertEqual(alignments[1], {'s2': ['0-0']})

    def test_empty_input(self):
        """Test handling of empty input."""
        content, sentences, sent_annotations, doc_annotations, alignments = parse_umr_file("")
        
        self.assertEqual(content, "")
        self.assertEqual(sentences, [])
        self.assertEqual(sent_annotations, [])
        self.assertEqual(doc_annotations, [])
        self.assertEqual(alignments, [])

    def test_malformed_input(self):
        """Test handling of malformed input without proper sections."""
        test_input = '''Some random text
without proper UMR format
# :: snt1	  This is a sentence .
but missing other required sections'''

        content, sentences, sent_annotations, doc_annotations, alignments = parse_umr_file(test_input)
        
        self.assertEqual(content, test_input)
        self.assertEqual(len(sentences), 1)
        self.assertEqual(sentences[0], ['This', 'is', 'a', 'sentence', '.'])
        self.assertEqual(sent_annotations, [""])
        self.assertEqual(doc_annotations, [""])
        self.assertEqual(alignments, [{}])

    def test_real_file_sample(self):
        """Test parsing with a real file sample."""
        try:
            with open('umr_annot_tool/resources/sample_input_files/english_umr-0001.umr', 'r') as f:
                content = f.read()
                
            content_out, sentences, sent_annotations, doc_annotations, alignments = parse_umr_file(content)
            
            # Test that we got some output
            self.assertTrue(len(sentences) > 0)
            self.assertTrue(len(sent_annotations) > 0)
            self.assertTrue(len(doc_annotations) > 0)
            self.assertTrue(len(alignments) > 0)
            
            # Test that sentences match their annotations
            self.assertEqual(len(sentences), len(sent_annotations))
            self.assertEqual(len(sentences), len(doc_annotations))
            self.assertEqual(len(sentences), len(alignments))
            
            # Test that annotations are properly formatted
            for annot in sent_annotations:
                if annot.strip():
                    self.assertTrue(annot.strip().startswith('('))
                    self.assertTrue(annot.strip().endswith(')'))
                    
            for annot in doc_annotations:
                if annot.strip():
                    self.assertTrue(annot.strip().startswith('('))
                    self.assertTrue(annot.strip().endswith(')'))
                    
            # Test content preservation
            self.assertEqual(content, content_out)
        except FileNotFoundError:
            # Skip test if sample file is not available
            self.skipTest("Sample file not found, skipping test")

if __name__ == '__main__':
    unittest.main() 