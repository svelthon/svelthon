<script lang="python">
# Functions imported from JavaScript under a marker's name are the author's:
# a call to one is a call, assigned or alone, and its value is data.
importjs {inspect} from './imported_markers.js'
importjs {derived, writable, get} from 'svelte/store'

answer = inspect(41)
inspect(1)
base = writable(1)
total = derived(base, lambda value: value * 2)
doubled = get(total)
</script>

<p>{answer}:{doubled}</p>
