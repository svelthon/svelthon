<script>
    // A JavaScript parent passing every prop of PropWrittenForms the same value.
    import PropWrittenForms from './PropWrittenForms.svelte';

    const names = ['m_def', 'm_class', 'm_import', 'm_from', 'm_except', 'm_match', 'm_star', 'm_rest',
        'f_def', 'f_class', 'f_import', 'f_except'];
    const given = Object.fromEntries(names.map((name) => [name, 'parent']));
    let child;

    export function edit() {
        child.edit();
    }
</script>

<PropWrittenForms bind:this={child} {...given} />
