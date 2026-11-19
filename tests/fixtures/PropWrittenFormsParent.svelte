<script>
    // A JavaScript parent passing every prop of PropWrittenForms the same value.
    import PropWrittenForms from './PropWrittenForms.svelte';

    const names = ['m_def', 'm_class', 'm_import', 'm_from', 'm_except', 'm_match', 'm_star', 'm_rest', 'm_vars', 'm_locals',
        'f_def', 'f_class', 'f_import', 'f_except', 'f_globals_attr', 'f_renamed', 'f_builtins', 'f_traceback'];
    const given = Object.fromEntries(names.map((name) => [name, 'parent']));
    let child;

    export function edit() {
        child.edit();
    }
</script>

<PropWrittenForms bind:this={child} {...given} />
