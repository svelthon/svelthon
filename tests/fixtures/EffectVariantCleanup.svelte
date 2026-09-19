<script lang="python">
# The three decorators emit the same teardown lines, so a cleanup recognised for
# one is recognised for all three. Written down rather than assumed: they are
# three code paths in the generator, and the nesting `@effect.root` adds is the
# one that could have put the cleanup somewhere else.
notify: object = None
generation = 0


class Resource:
    def __init__(self, name):
        self.name = name

    def close(self):
        notify(self.name + "-close")


plain_resource = Resource("plain")
pre_resource = Resource("pre")
root_resource = Resource("root")


@effect
def plain_watch():
    notify("plain-open:" + str(generation))
    return plain_resource.close


@effect.pre
def pre_watch():
    notify("pre-open:" + str(generation))
    return pre_resource.close


@effect.root
def stop():
    notify("root-open:" + str(generation))
    return root_resource.close


@export
def bump():
    global generation
    generation += 1


@export
def end_root():
    stop()
</script>

<p data-k="generation">{generation}</p>
