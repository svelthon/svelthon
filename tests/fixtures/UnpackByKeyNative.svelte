<script>
// The same rows in Svelte's own language: unpacking an object by key reads
// what the dot reads, and follows the row when it changes.
class Cat {
    id = $state();
    name = $state();

    constructor(id, name) {
        this.id = id;
        this.name = name;
    }
}

const dicts = $state([{ id: 1, name: 'Tom' }]);
const instances = $state([new Cat(2, 'Felix'), new Cat(3, 'Garfield')]);
const partial = [{ id: 4 }];

const rename = () => {
    dicts[0].name = 'Thomas';
};

const turn = () => {
    instances.reverse();
};
</script>

<p data-k="dict-dot">{#each dicts as row}{row.id}:{row.name}{/each}</p>
<p data-k="dict-key">{#each dicts as { id, name }}{id}:{name}{/each}</p>
<p data-k="instance-dot">{#each instances as row}{row.id}:{row.name};{/each}</p>
<p data-k="instance-key">{#each instances as { id, name }}{id}:{name};{/each}</p>
<p data-k="keyed">{#each instances as { id, name } (id)}<b data-id={id}>{name}</b>{/each}</p>
<p data-k="default">{#each partial as { id, name = 'anon' }}{id}:{name}{/each}</p>
<p data-k="renamed">{#each dicts as { name: called }}{called}{/each}</p>
{#snippet card({ id, name })}<i>{id}:{name}</i>{/snippet}
<p data-k="snippet">{@render card(instances[0])}</p>
{#await instances[1] then { name }}<p data-k="await">{name}</p>{/await}
<button class="rename" onclick={rename}>rename</button>
<button class="turn" onclick={turn}>turn</button>
