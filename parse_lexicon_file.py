from bs4 import BeautifulSoup
import bs4
from typing import Any, Dict, List, Set, Tuple
import warnings
import attr
from collections import ChainMap, defaultdict


@attr.s(repr=False, frozen=False)
class Entry:
    lemma: str = attr.ib()
    frames: List[Dict] = attr.ib(factory=list)

    def add_frame(self, frame: Dict) -> None:
        self.frames.append(frame)

    def edit_frame(self, frame_number: int, frame: Dict) -> None:
        self.frames[frame_number] = frame

    def delete_frame(self, frame_number: int):
        del self.frames[frame_number]

    @property
    def flatten(self) -> Dict[str, Dict]:
        return {f"{self.lemma}-{str(n).zfill(2)}": frame for n, frame in enumerate(self.frames)}

    def __repr__(self) -> str:
        return f"lemma: {self.lemma}, frame_count: {len(self.frames)}"


@attr.s(repr=False, frozen=False)
class FrameDict:
    lemmas: Set[str] = attr.ib(factory=set)
    entries: Dict[str, Entry] = attr.ib(factory=dict)

    @classmethod
    def from_entries(cls, entries: List[Entry]) -> "FrameDict":
        lemmas = set(entry.lemma for entry in entries)
        assert len(lemmas) == len(entries), "duplicated lemmas!"
        return cls(lemmas, {entry.lemma: entry for entry in entries})

    @classmethod
    def from_dict(cls, frames_dict: Dict[str, Dict]) -> "FrameDict":
        entry_dict = defaultdict(list)
        for key in frames_dict:
            # TODO: keep original frame number? (e.g. 91)
            lemma, _ = cls.parse_frame_key(key)
            entry_dict[lemma].append(frames_dict[key])
        entries = [Entry(lemma, entry_dict[lemma]) for lemma in entry_dict]
        return cls.from_entries(entries)

    @staticmethod
    def parse_frame_key(frame_key: str) -> Tuple[str, int]:
        components = frame_key.rsplit("-", 1)
        if len(components) == 1:
            return components[0], -1
        else:
            return components[0], int(components[1])

    def add_frame(self, lemma: str, frame: Dict):
        self.lemmas.add(lemma)
        entry = self.entries.setdefault(lemma, Entry(lemma))
        entry.add_frame(frame)

    def edit_frame(self, frame_key: str, frame: Dict):
        lemma, frame_number = self.parse_frame_key(frame_key)
        entry = self.entries[lemma]
        entry.edit_frame(frame_number, frame)

    def delete_frame(self, frame_key: str):
        lemma, frame_number = self.parse_frame_key(frame_key)
        entry = self.entries[lemma]
        entry.delete_frame(frame_number)

    @property
    def flatten(self):
        return dict(ChainMap(*(self.entries[k].flatten for k in self.entries)))


def parse_lexicon_xml(xml_str: str):
    frames_dict = {}
    soup = BeautifulSoup(xml_str, "html.parser")
    entries = soup.find_all("div", attrs={"class": "entry"})

    for entry in entries:
        frames_dict.update(parse_entry(entry))
    return frames_dict


def parse_entry(entry: bs4.element.Tag):
    head = entry.find("span", {"class": "mainheadword"})
    word_root = entry.find("span", {"class": "lexemeform"})
    senses = entry.find("span", {"class": "senses"})
    pos = senses.find("span", {"class": "sharedgrammaticalinfo"})

    head_str = head.get_text(strip=True)
    word_root_str = word_root.get_text(strip=True)
    pos_str = pos.get_text(strip=True)

    sense_contents = senses.find_all("span", {"class": "sensecontent"})
    senses_lst = [parse_sense_content(sc) for sc in sense_contents]

    return {head_str: {"root": word_root_str, "pos": pos_str, "sense": senses_lst, 'inflected_forms': []}}


def parse_sense_content(sense_content: bs4.element.Tag):
    sense = sense_content.find("span", {"class": "sense"})
    gloss_str = sense.find("span", {"class": "definitionorgloss"}).get_text(strip=True)
    args_str = sense.find("span", {"class": "argument-structure"}).get_text(strip=True)

    frames = sense.find_all("span", "coding-frame")
    frames_str_lst = [frame.get_text(strip=True) for frame in frames]

    return {
        "gloss": gloss_str,
        "args": args_str,
        "coding_frames": "#sep".join(frames_str_lst),
    }


if __name__ == '__main__':
    # fd = FrameDict()
    # fd.add_frame("a", {"1": "2"})
    # fd.add_frame("b", {"1": "2"})
    # fd.add_frame("a", {"1": "2"})
    # fd.add_frame("a", {"1": "2"})
    # fd.add_frame("b", {"1": "2"})
    #
    #
    # print(fd.entries)
    # print(fd.to_dict())
    lexicon_xml_path = "/Users/jinzhao/schoolwork/lab-work/umr_annot_tool_resources/people/jens_van_gysel/Flex lexicon.xml"
    with open(lexicon_xml_path, "r") as f:
        content_string = f.read()
    frames_dict = parse_lexicon_xml(content_string)
    fd = FrameDict.from_dict(frames_dict)
    print(fd.lemmas)
    print(fd.flatten.keys())
    print(fd.flatten)

    fd.add_frame("enyalantema", {1: 2})
    fd.add_frame("enyalantema", {3: 4})
    fd.add_frame("enyalantema", {3: 4})
    fd.add_frame("enyalantema", {3: 4})
    fd.add_frame("enyalantema", {3: 4})

    fd.edit_frame("enya'hema-00", {1: 2})

    print(fd.flatten.keys())
    print(fd.flatten)

    fd.delete_frame("enmama-00")
    fd.delete_frame("enyalantema-01")
    print("=======")

    print(fd.flatten.keys())
    print(fd.flatten)


