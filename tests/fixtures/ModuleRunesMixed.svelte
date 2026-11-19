<script module>
    // A rune name and an ordinary one exported by one declaration, and by one
    // that takes a value apart.
    export const state = 'ready', caption = 'card';
    export const { derived, label } = { derived: 'd', label: 'l' };
</script>

<script lang="python">
count = 0
</script>

<p>{state}:{caption}:{derived}:{label}</p>
