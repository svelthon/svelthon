<script lang="python">
# A row unpacked by key, `as {id, name}`, beside the same row read by the dot.
# The two spell one thing, so every row below renders the same both ways.
class Cat:
    def __init__(self, id, name):
        self.id = id
        self.name = name


dicts = [{"id": 1, "name": "Tom"}]
instances = [Cat(2, "Felix"), Cat(3, "Garfield")]
partial = [{"id": 4}]


def rename():
    dicts[0]["name"] = "Thomas"


def turn():
    instances.reverse()
</script>

<p data-k="dict-dot">{#each dicts as row}{row.id}:{row.name}{/each}</p>
<p data-k="dict-key">{#each dicts as {id, name}}{id}:{name}{/each}</p>
<p data-k="instance-dot">{#each instances as row}{row.id}:{row.name};{/each}</p>
<p data-k="instance-key">{#each instances as {id, name}}{id}:{name};{/each}</p>
<p data-k="keyed">{#each instances as {id, name} (id)}<b data-id={id}>{name}</b>{/each}</p>
<p data-k="default">{#each partial as {id, name="anon"}}{id}:{name}{/each}</p>
<p data-k="rest">{#each dicts as {id, ...rest}}{id}:{rest}{/each}</p>
<p data-k="renamed">{#each dicts as {"name": called}}{called}{/each}</p>
{#snippet card({id, name})}<i>{id}:{name}</i>{/snippet}
<p data-k="snippet">{@render card(instances[0])}</p>
{#await instances[1] then {name}}<p data-k="await">{name}</p>{/await}
<button class="rename" onclick={rename}>rename</button>
<button class="turn" onclick={turn}>turn</button>
