<svelte:options customElement="prototype-typed" />

<script lang="python">
# Props annotated with classes of the author's spelled like properties of
# `Object.prototype`: no type Svelte converts to.
class constructor:
    pass


class toString:
    pass


first: constructor = None
second: toString = None
</script>

<p>{first}|{second}</p>
