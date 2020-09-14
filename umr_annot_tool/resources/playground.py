from bs4 import BeautifulSoup
import urllib.request
import json

# this is used to get the chinese frame files json file from 'http://verbs.colorado.edu/chinese/cpb/html_frames/index.html'

def parse_frame_url(index_page_url):
    """
    generate frames_chinese.json
    :param index_page_url: 'http://verbs.colorado.edu/chinese/cpb/html_frames/index.html'
    :return: None
    """
    frame_dict = dict()
    html = urllib.request.urlopen(index_page_url)
    content = html.read().decode('gbk', 'ignore')
    soup = BeautifulSoup(content, 'html.parser')
    results = soup.find_all('a')
    for item in results:
        frame_dict.update(parse_predicate_url(item.text, 'http://verbs.colorado.edu/chinese/cpb/html_frames/' + item['href']))
        break
        # print(item['href'])
        # print(item.text)
    with open('test_frames_chinese.json', 'w') as json_file:
        json.dump(frame_dict, json_file)

def parse_predicate_url(predicate, url):
    """
    :param predicate: predicate string '走'
    :param url: 'http://verbs.colorado.edu/chinese/cpb/html_frames/4765-zou.html'
    :return: {'走-01': {'ARG0:': 'entity moving', 'ARG1:': 'road arg0 takes', 'ARG2:': 'location arg0 walks to'}, '走-02': {'ARG0:': 'agent'}, '走-03': {'ARG0:': 'agent', 'ARG1:': 'people visited'}, '走-04': {'ARG0:': 'agent', 'ARG1:': 'move'}, '走-05': {'ARG0:': 'agent', 'ARG1:': 'place arg0 descended from'}, '走-06': {'ARG0:': 'agent', 'ARG1:': 'place arg0 step up to'}, '走-07': {'ARG0:': 'agent', 'ARG1:': 'place arg0 left'}, '走-08': {'ARG0:': 'agent', 'ARG1:': 'procedure, program'}}
    """
    predicate_dict = dict()
    html = urllib.request.urlopen(url)
    content = html.read().decode('gbk', 'ignore')
    soup = BeautifulSoup(content, 'html.parser')

    roles = [ele.text for ele in soup.find_all('b') if ele.text[-1] == ':']
    explanations = [ele.text for ele in soup.find_all('i')]
    indices = [i for i, str in enumerate(roles) if third_index_zero(str)]
    print(indices)

    for i, index in enumerate(indices):
        roles_dict = dict()
        if i < len(indices) -1:
            for j in range(indices[i], indices[i+1]):
                roles_dict[roles[j]] = explanations[j]
            predicate_dict[predicate + '-0' + str(i+1)] = roles_dict
        else:
            for j in range(indices[i], len(roles)):
                roles_dict[roles[j]] = explanations[j]
            predicate_dict[predicate + '-0' + str(i+1)] = roles_dict
    return predicate_dict

def third_index_zero(str):
    if str[3] == '0':
        return True
    else:
        return False



if __name__ == '__main__':
    parse_frame_url('http://verbs.colorado.edu/chinese/cpb/html_frames/index.html')
    # parse_predicate_url('走', 'http://verbs.colorado.edu/chinese/cpb/html_frames/4765-zou.html')
