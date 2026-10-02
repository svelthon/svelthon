<script lang="python">
importjs {inspect, Inspector, back, service, registry, add, remove} from './engine_crossing.js'
importjs * as Library from './engine_crossing.js'
importjs library from './engine_crossing.js'
route: prop = 'named'
kind: prop = 'alias'

class Rows(list):
    def __call__(self):
        return 'list'

class Pair(tuple):
    def __call__(self):
        return 'tuple'

class Bag(dict):
    def __call__(self):
        return 'dict'

def call(kind, a, b=None):
    if route == 'named':
        return inspect(kind, a, b)
    elif route == 'namespace':
        return Library.inspect(kind, a, b)
    elif route == 'default':
        return library.inspect(kind, a, b)
    elif route == 'nested':
        return Library.nested.inspect(kind, a, b)
    elif route == 'named-new':
        return Inspector.new(kind, a, b).answer
    return Library.Inspector.new(kind, a, b).answer

def answer():
    if kind == 'alias':
        shared = ['A']
        return call('alias', shared, shared)
    elif kind == 'nested-alias':
        shared = ['A']
        return call('nested-alias', {'left': shared, 'right': shared})
    elif kind == 'list-cycle':
        rows = []
        rows.append(rows)
        return call('list-cycle', rows)
    elif kind == 'dict-cycle':
        row = {}
        row['self'] = row
        return call('dict-cycle', row)
    elif kind == 'append':
        box = {'rows': ['A']}
        before = call('rows', box)
        box['rows'].append('B')
        return before + ';' + call('rows', box)
    elif kind == 'clear':
        box = {'rows': ['A']}
        before = call('keys', box)
        box.clear()
        return before + ';' + call('keys', box)
    elif kind == 'callables':
        return ','.join(call('call', one) for one in [Rows([1]), Pair((1,)), Bag()])
    elif kind == 'none':
        return call('none', None, [None])
    elif kind == 'returned':
        rows = ['A']
        box = {'rows': rows}
        if route == 'named':
            given = [back(rows), back(box)]
        elif route == 'namespace':
            given = [Library.back(rows), Library.back(box)]
        elif route == 'default':
            given = [library.back(rows), library.back(box)]
        else:
            given = [Library.nested.back(rows), Library.nested.back(box)]
        return ','.join(str(one) for one in [given[0] is rows, given[1] is box])
    elif kind in ('frozen', 'sealed', 'nonextensible'):
        box = service(kind)
        held = registry()
        if route == 'named':
            add(held, box.run)
            return str(remove(held, box.run))
        Library.add(held, box.run)
        return str(Library.remove(held, box.run))

text = answer()
</script>

<p>{text}</p>
