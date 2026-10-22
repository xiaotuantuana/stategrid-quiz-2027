"""Retain a single worked example per authored numeric family; archive exclusions."""
import copy


def clean_questions(questions):
    retained, removed, families = [], [], {}
    for source in questions:
        q = copy.deepcopy(source)
        if q['origin'] == '原创参数变式':
            key = (q['topic'], q['family'])
            if key in families:
                removed.append({'question': source, 'retained_id': families[key], 'reason': '同一计算题型仅替换数值，保留一个代表题'})
                continue
            families[key] = q['id']
            q['origin'] = '原创计算题'
        retained.append(q)
    binary_id = families[('P01', '二进制转十进制')]
    for q in retained[:]:
        if q['id'] in ('old_jsj05', 'old_jsj22'):
            retained.remove(q)
            removed.append({'question': q, 'retained_id': binary_id, 'reason': '与保留的二进制整数转十进制题仅数值和措辞不同'})
    return retained, removed
