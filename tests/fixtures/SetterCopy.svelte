<script lang="python">
# A `__setattr__` that stores a *copy* of what it was given, which is an ordinary
# way to defend an invariant, and keeps an alias to what it stored.
#
# Four things make this measurable, and each is deliberate.
#
# The alias lives in a **closure**, not at module level: a module-level list is
# watched itself, so mutating something it holds would notify through it and the
# bench could not fail.
#
# `__str__` and `mutate` read that alias rather than `self.rows`: reading the
# attribute goes through the watch's own read wrapper, which hands the child the
# link that is missing, and would repair the very thing being measured.
#
# The template renders `{box}`, so what the paragraph depends on is the *object*,
# which is the only route a notification can take.
#
# And each box is bound by an assignment of its own: a tuple target binds names
# without declaring state, so a factory returning four names would leave the
# paragraph subscribed to nothing at all. Measured, by writing it that way first.
def make(copy):
    children = []

    class Box:
        def __setattr__(self, name, value):
            child = list(value) if copy else value
            children.append(child)
            object.__setattr__(self, name, child)

        def __str__(self):
            return str(children[0]) if children else "[]"

        def install(self):
            self.rows = []

        def mutate(self):
            children[0].append(1)

        def snapshot(self):
            return str(children[0]) if children else "[]"

    return Box()


copied = make(True)
direct = make(False)


# The model, read from the test rather than from the page: a paragraph holding a
# call reads it once and never again, since nothing it depends on changes, and a
# stale paragraph would say nothing about the state.
@export
def model(which):
    return copied.snapshot() if which == "copied" else direct.snapshot()
</script>

<button data-k="install-copied" onclick={lambda: copied.install()}>install</button>
<button data-k="mutate-copied" onclick={lambda: copied.mutate()}>mutate</button>
<p data-k="copied">{copied}</p>

<button data-k="install-direct" onclick={lambda: direct.install()}>install</button>
<button data-k="mutate-direct" onclick={lambda: direct.mutate()}>mutate</button>
<p data-k="direct">{direct}</p>
