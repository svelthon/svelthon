<script lang="python">
# Each class below is named like something bound in a branch that is not the
# one rendered, so the script's own class is what every `fallback` reads.
# Classes and not assignments: an assigned name is also a JavaScript name in
# the component, which would answer the read and hide the defect.
class row:
    label = "fallback"


class result:
    label = "fallback"


class token:
    label = "fallback"


class item:
    label = "fallback"


class flag:
    label = "fallback"


# Read by the expression that opens a block whose body declares a snippet of
# the same name: the head is read where the block stands.
class head:
    active = True
    rows = [1]
    key = 1


rows = []
outer = ["outer"]
</script>

{#each rows as row}
    <span>{row}</span>
{:else}
    <p data-k="each">{row.label}</p>
{/each}

{#await None catch result}
    <span>{result}</span>
{:then}
    <p data-k="await">{result.label}</p>
{/await}

{#if False}
    {token = 1}
    <span>{token}</span>
{:else}
    <p data-k="declaration">{token.label}</p>
{/if}

{#if False}
    {#snippet item()}<span>hidden</span>{/snippet}
    {@render item()}
{:else}
    <p data-k="snippet">{item.label}</p>
{/if}

{#if False}
    {flag = 1}
{:else if flag.label}
    <p data-k="else-if">{flag.label}</p>
{/if}

{#if head.active}
    {#snippet head()}<span>unused</span>{/snippet}
    <p data-k="head-if">fallback</p>
{/if}

{#if False}
    <span>no</span>
{:else if head.active}
    {#snippet head()}<span>unused</span>{/snippet}
    <p data-k="head-else-if">fallback</p>
{/if}

{#key head.key}
    {#snippet head()}<span>unused</span>{/snippet}
    <p data-k="head-key">fallback</p>
{/key}

{#each head.rows}
    {#snippet head()}<span>unused</span>{/snippet}
    <p data-k="head-each">fallback</p>
{/each}

<!-- What a branch does bind is still seen: a clause parameter, a name from
     an enclosing block, a snippet declared later in the same branch. -->
{#await 5}
    <span>pending</span>
{:then value}
    <p data-k="then">{value + 1}</p>
{/await}

{#each outer as name}
    {#if False}
        <span>{name}</span>
    {:else}
        <p data-k="outer">{name}</p>
    {/if}
{/each}

{#if False}
    <span>no</span>
{:else}
    <p data-k="late">{"late" if late else "none"}</p>
    {#snippet late()}<span>late</span>{/snippet}
{/if}
