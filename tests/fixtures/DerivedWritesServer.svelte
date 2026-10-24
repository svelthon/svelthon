<script lang="python">
# The three spellings of a derived, written at the top of the script past
# their declaration, as a server renders it.
base = 1
arrow => base * 2


@derived
def decorated():
    return base * 3


called = derived(lambda: base * 4)

arrow = decorated = called = 99
</script>

<output>{arrow} {decorated} {called}</output>
