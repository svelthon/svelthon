<script>
    // A child whose prop happens to be called `group`. Svelte binds it like any
    // other prop: a component has no group machinery, and `bind:group` there
    // means the prop of that name.
    //
    // Written in JavaScript, not Python, and that is itself a finding: a Python
    // component cannot declare a prop called `group` today, because the
    // generated module imports a runtime function under that name and Svelte
    // answers `Identifier 'group' has already been declared`.
    let { group = $bindable('a') } = $props();
</script>

<output data-k="child">{group}</output>
<button data-k="pick" onclick={() => (group = 'z')}>pick</button>
