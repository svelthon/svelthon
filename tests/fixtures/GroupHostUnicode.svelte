<script module>
    import Étiquette from './GroupProp.svelte';
    import Δ from './GroupProp.svelte';
</script>

<script lang="python">
# A component whose name starts with a capital past ASCII is a component, as
# Svelte reads one: `bind:group` there is the prop of that name, in both
# spellings.
chosen = "a"
group = "b"
</script>

<div data-k="long"><Étiquette bind:group={chosen} /></div>
<div data-k="short"><Δ bind:group /></div>
<p data-k="chosen">{chosen}</p>
<p data-k="group">{group}</p>
