// A JavaScript load asking a Python remote function on the server, which reads
// its answer as the browser reads it: rebuilt from what it reduces to. And the
// answer itself returned beside what was read of it, rebuilt once only; the
// answer of one a factory of another module made; an answer this load changes,
// which the browser reads changed; and one whose reduction counts its runs,
// rebuilt once as CPython rebuilds it.
import { relayed, relayed_made, relayed_changed, relayed_shelf } from '#lib/relayed.remote.py';
import { read } from '#lib/label.py';

export async function load() {
    const label = await relayed();
    const changed = await relayed_changed();

    changed.text = `${read(changed)} / PUBLIC`;

    return {
        text: read(label),
        label,
        made: read(await relayed_made()),
        changed,
        changedText: read(changed),
        shelf: `shelf:${(await relayed_shelf()).count}`
    };
}
