<script lang="python">
# A default that makes a function reading a name an element after it binds:
# the function reads the name once it is bound, as JavaScript's and Python's
# do, where a read while the default is taken raises.
given: object
</script>

{#snippet both([saved=lambda: later, later=7])}<output data-k="snippet-both">{saved()}:{later}</output>{/snippet}
{#snippet given_later([saved=lambda: later, later])}<output data-k="snippet-given">{saved()}:{later}</output>{/snippet}
{@render both([])}
{@render given_later(given)}
{#each [[]] as [saved=lambda: later, later=7]}<output data-k="each-both">{saved()}:{later}</output>{/each}
{#each [given] as [saved=lambda: later, later]}<output data-k="each-given">{saved()}:{later}</output>{/each}
