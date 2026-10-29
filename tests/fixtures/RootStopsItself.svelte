<script lang="python">
# A pre root that stops itself the first time it runs, which is while the root
# is being made: it must be destroyed once made, its cleanup run, and run no
# more.
capture: object
count = 0


@effect.root
@effect.pre
def root():
    capture("run", count)
    if count == 0:
        root()
    return lambda saved=count, write=capture: write("clean", saved)


@export
def bump():
    global count
    count += 1
</script>

<output>{count}</output>
