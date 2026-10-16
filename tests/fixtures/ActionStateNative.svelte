<script module>
    class Box {
        constructor(held) {
            this.model = held;
        }
    }
</script>

<script>
    // ActionState in Svelte: its containers are states of its own, and its
    // instance a class's. The prop is read once, by a function, as the Python
    // child reads it once.
    let { model, observe, report, python_action = false } = $props();
    const given = () => model;
    let rows = $state([given()]);
    let record = $state({ child: given() });
    let nested = $state({ child: { inner: given() } });
    let box = new Box(given());
    let slotted = new Box(given());
    let mixed = new Box(given());
    let local = $state([{ n: 1 }]);

    export function bump_local() {
        local[0].n += 1;
    }
</script>

<div data-k="direct" use:observe={model}></div>
<div data-k="list" use:observe={rows}></div>
<div data-k="dict" use:observe={record}></div>
<div data-k="nested" use:observe={nested}></div>
<div data-k="instance" use:observe={box}></div>
<div data-k="slots" use:observe={slotted}></div>
<div data-k="mixed" use:observe={mixed}></div>
<div data-k="local" use:observe={local}></div>
<p>{model.n}|{rows[0].n}|{record.child.n}|{nested.child.inner.n}|{box.model.n}|{slotted.model.n}|{mixed.model.n}|{local[0].n}</p>
