<script lang="python">
# A Python component that renders the snippet it is handed with names of its
# own, written `{@ render …}`, as the template lets the sign be spaced.
children: object
capture: object
count = 7
</script>

{@ render children(count, capture)}
