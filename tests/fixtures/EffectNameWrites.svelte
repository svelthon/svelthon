<script lang="python">
# An effect's name written past its declaration, by `=` or by `del`: the
# name's alone, and the effect keeps running the body it was declared with.
notify: object
count = 1
saved = None


@effect
def watch():
    notify(f"watch {count}")


@effect.pre
def early():
    notify(f"early {count}")


@effect.root
def rooted():
    notify(f"rooted {count}")


@export
def rename():
    global watch, early, rooted, saved
    saved = rooted
    watch = early = rooted = 5
    return f"{watch} {early} {rooted}"


@export
def drop():
    global watch, early, rooted, saved
    saved = rooted
    del watch, early, rooted
    return " ".join(str(name in globals()) for name in ("watch", "early", "rooted"))


@export
def bump():
    global count
    count += 1


@export
def stop():
    saved()
</script>

<p>{count}</p>
