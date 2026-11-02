<script>
    // The parent of ActionGetter and of its Svelte twin: a state holding an
    // instance whose getter counts its reads, and an action that writes the
    // value it read, with an `update`, without one, or no action at all.
    let { Child, mode } = $props();
    let phase = $state(1);
    let reads = 0;

    class Meter {
        get token() {
            reads += 1;
            return `${phase}:${reads}`;
        }
    }

    const model = $state({ meter: new Meter() });

    function observe(node, value) {
        node.dataset.token = value.meter.token;

        return mode === 'update'
            ? {
                  update(next) {
                      node.dataset.token = next.meter.token;
                  }
              }
            : {};
    }

    const act = $derived(mode === 'absent' ? undefined : observe);

    export function change() {
        phase += 1;
    }

    export function counted() {
        return reads;
    }
</script>

<Child {model} {act} />
