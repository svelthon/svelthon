<script module>
    import GroupProp from './GroupProp.svelte';
</script>

<script lang="python">
# `bind:group` on a component is an ordinary prop binding. It used to be
# rewritten into `use:__group`, which Svelte refuses outright on a component:
# "This type of directive is not valid on components".
chosen = "a"
</script>

<GroupProp bind:group={chosen} />
<p data-k="parent">{chosen}</p>
