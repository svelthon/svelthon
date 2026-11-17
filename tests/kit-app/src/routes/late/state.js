// A `load` bound only once a request has asked for it.
export let load;

export function enable() {
    load = () => ({ phase: 'enabled' });
}
