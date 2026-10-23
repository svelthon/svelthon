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
    let listbox = $state([new Box(given())]);
    let dictbox = $state({ child: new Box(given()) });
    let tuplebox = $state([new Box(given())]);
    let listslots = $state([new Box(given())]);

    class Gauge {
        get amount() {
            return model.n;
        }
    }
    class Inherited extends Gauge {}
    let gauged = $state([new Gauge()]);
    let inherited = $state([new Inherited()]);
    class CountedList extends Array {
        get amount() {
            return model.n;
        }
    }
    class CountedDict {
        get amount() {
            return model.n;
        }
    }
    class CountedSet extends Set {
        get amount() {
            return model.n;
        }
    }
    let countedlist = $state([new CountedList(1)]);
    let counteddict = $state([new CountedDict()]);
    let countedset = $state([new CountedSet([1])]);
    let countedtuple = $state([new CountedList(1)]);
    class CountedNumber extends Number {
        get amount() {
            return model.n;
        }
    }
    class CountedString extends String {
        get amount() {
            return model.n;
        }
    }
    class CountedBytes extends Uint8Array {
        get amount() {
            return model.n;
        }
    }
    let countedint = $state([new CountedNumber(1)]);
    let countedfloat = $state([new CountedNumber(1.5)]);
    let countedstr = $state([new CountedString('a')]);
    let countedbytes = $state([new CountedBytes([97])]);
    let countedbytearray = $state([new CountedBytes([97])]);

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
<div data-k="listbox" use:observe={listbox}></div>
<div data-k="dictbox" use:observe={dictbox}></div>
<div data-k="tuplebox" use:observe={tuplebox}></div>
<div data-k="listslots" use:observe={listslots}></div>
<div data-k="gauged" use:observe={gauged}></div>
<div data-k="inherited" use:observe={inherited}></div>
<div data-k="countedlist" use:observe={countedlist}></div>
<div data-k="counteddict" use:observe={counteddict}></div>
<div data-k="countedset" use:observe={countedset}></div>
<div data-k="countedtuple" use:observe={countedtuple}></div>
<div data-k="countedint" use:observe={countedint}></div>
<div data-k="countedfloat" use:observe={countedfloat}></div>
<div data-k="countedstr" use:observe={countedstr}></div>
<div data-k="countedbytes" use:observe={countedbytes}></div>
<div data-k="countedbytearray" use:observe={countedbytearray}></div>
<p>{model.n}|{rows[0].n}|{record.child.n}|{nested.child.inner.n}|{box.model.n}|{slotted.model.n}|{mixed.model.n}|{local[0].n}</p>
