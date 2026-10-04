<script>
// The same chain in Svelte's own language, deep state included.
const size = 20000;

const build = (n) => {
    let head = null;
    for (let i = 0; i < n; i++) head = { value: i, rest: head };
    return head;
};

const chain = $state(build(size));
const held = $state([]);

const length = (at) => {
    let count = 0;
    while (at !== null) {
        count += 1;
        at = at.rest;
    }
    return count;
};

const last = () => {
    let at = chain;
    while (at.rest !== null) at = at.rest;
    return at;
};

const bump = () => {
    last().value += 1;
};

const hold = () => {
    held.push(build(size));
};
</script>

<p data-k="chain">{length(chain)}:{last().value}</p>
<p data-k="held">{held.length}:{held.length ? length(held[0]) : 0}</p>
<button class="bump" onclick={bump}>bump</button>
<button class="hold" onclick={hold}>hold</button>
