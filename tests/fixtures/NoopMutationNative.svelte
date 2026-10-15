<script>
    // The same reads in Svelte, over its own reactive collections: the witness
    // for NoopMutation.
    import { SvelteSet, SvelteMap } from 'svelte/reactivity';
    import { untrack } from 'svelte';
    import { crossing } from './js_collections.js';

    let { kind = 'set add present' } = $props();

    const [crossedMap, crossedKey] = untrack(() => crossing(kind, SvelteMap));

    class Box {}
    const heldRow = [1, 2];
    const heldTable = new SvelteMap([
        ['list', heldRow],
        ['dict', { a: 1 }],
        ['instance', new Box()],
        ['function', () => 1],
        [heldRow, 'keyed']
    ]);

    const flags = new SvelteSet([1]);
    const empty = new SvelteSet();
    const labels = new SvelteMap([['x', 'yes']]);
    const mixed = new SvelteMap([
        [1, 'yes'],
        ['b', 1]
    ]);
    const measures = new SvelteMap([['x', 2.5]]);
    const keyed = new SvelteSet([1, 'key']);
    const held = new SvelteSet([1]);
    const bare = new SvelteSet();
    const table = new SvelteMap([['x', 'yes']]);
    const bareTable = new SvelteMap();

    let items = $state([]);

    function read() {
        if (kind === 'set add present') return flags.add(1).size;
        if (kind === 'set discard absent') return (flags.delete(2), flags.size);
        if (kind === 'set clear empty') return (empty.clear(), empty.size);
        if (kind === 'set symmetric empty') return flags.size;
        if (kind === 'set intersection all') return flags.size;
        if (kind === 'set symmetric swap') return (flags.delete(1), flags.add(2), flags.size);
        if (kind === 'set add nested present') return (keyed.add(1), keyed.add('key'), keyed.size);
        if (kind === 'set add nested absent') return (keyed.add(3), keyed.add('key'), keyed.size);
        if (kind === 'dict setdefault present') return labels.has('x') ? labels.get('x') : (labels.set('x', 'no'), 'no');
        if (kind === 'dict pop absent') return labels.has('missing') ? labels.get('missing') : 'absent';
        if (kind === 'dict update empty') return labels.get('x');
        if (kind === 'dict update same') return (labels.set('x', labels.get('x')), labels.get('x'));
        if (kind === 'dict setitem same') return (labels.set('x', labels.get('x')), labels.get('x'));
        if (kind === 'dict update keywords' || kind === 'dict update pairs') return (labels.set('x', labels.get('x')), labels.get('x'));
        if (kind === 'dict mixed update') return (mixed.set(1, mixed.get(1)), mixed.get(1));
        if (kind === 'dict setitem same float') return (measures.get('x'), measures.set('x', 2.5), measures.get('x') === 2.5 ? 'yes' : 'no');
        if (kind === 'dict del absent') return (labels.delete('missing'), labels.get('x'));
        if (kind === 'dict setitem new value') return (labels.set('x', 'no'), labels.get('x'));
        if (kind === 'set add absent') return flags.add(2).size;
        if (kind === 'dict setdefault absent') return labels.has('missing') ? labels.get('missing') : (labels.set('missing', 'new'), 'new');
        if (kind === 'js set add present') return held.add(1).size;
        if (kind === 'js set delete absent') return (held.delete(2), held.size);
        if (kind === 'js set clear empty') return (bare.clear(), bare.size);
        if (kind === 'js map set same') return (table.set('x', table.get('x')), table.get('x'));
        if (kind === 'js map delete absent') return (table.delete('missing'), table.size);
        if (kind === 'js map clear empty') return (bareTable.clear(), bareTable.size);
        if (kind === 'frame set add present') return held.add(1).size;
        if (kind === 'frame set delete absent') return (held.delete(2), held.size);
        if (kind === 'frame map set same') return (table.set('x', table.get('x')), table.get('x'));
        if (kind === 'frame set add absent') return held.add(2).size;
        if (kind === 'js set add absent') return held.add(2).size;
        if (kind === 'js map set new') return (table.set('x', 'no'), table.get('x'));
        if (kind.startsWith('js map same ')) return (crossedMap.set(crossedKey, crossedMap.get(crossedKey)), crossedMap.size);
        if (kind.startsWith('js map new ')) return (crossedMap.set(crossedKey, 2.5), crossedMap.size);
        if (kind.startsWith('js map held same ')) {
            const at = kind.endsWith(' key') ? heldRow : kind.split(' ').at(-1);
            return (heldTable.set(at, heldTable.get(at)), heldTable.size);
        }
        if (kind === 'js map held new list') return (heldTable.set('list', [1, 2]), heldTable.size);

        items.push(...[]);

        return items.length;
    }
</script>

<output>{read()}</output>
