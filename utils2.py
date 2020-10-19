from typing import List

def load_list_to_options(filename:str) -> List[str]:
    with open(filename, 'r') as f:
        data = f.read()

    items = data.strip().split(',')
    options = [f"<option value='{item.strip()}'>" for item in items]
    for opt in options:
        print(opt)




if __name__ == '__main__':
    load_list_to_options('/Users/jinzhao/Desktop/ne_list.txt')