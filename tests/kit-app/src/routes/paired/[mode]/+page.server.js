// A remote function's pair this load takes apart, or makes of one, handed to
// its page as its one Python value: after a navigation the browser read the
// sharing the remote function answered, before the load's write.
import { relayed_dicts } from '#lib/relayed.remote.py';
import { regroup, sharing } from '#lib/label.py';

export async function load({ params }) {
    const pair = regroup(await relayed_dicts(params.mode), params.mode);

    return { server: sharing(pair), pair };
}
