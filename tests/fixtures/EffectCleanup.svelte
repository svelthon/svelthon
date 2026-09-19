<script lang="python">
# What an effect hands back is a Python value, and Python has more callables
# than JavaScript does. Every row below is one of them, plus the two shapes that
# are not callable at all and must be left alone.
notify: object = None

# A JavaScript function, handed in by the caller: the shape that always worked,
# kept as the witness beside the ones that did not.
js_cleanup: object = None

how: str = "bound"
generation = 0


class Resource:
    def __init__(self, name):
        self.name = name

    def close(self):
        notify(self.name + "-close")

    @staticmethod
    def close_static():
        notify("static-close")

    @classmethod
    def close_class(cls):
        notify("class-close")


class Closer:
    # A callable instance: Python calls it, `typeof` calls it an object.
    def __call__(self):
        notify("instance-close")


resource = Resource("bound")
closer = Closer()


@effect
def watch():
    # Reading `generation` is what subscribes the effect to it.
    notify("open:" + str(generation))

    if how == "bound":
        return resource.close

    if how == "instance":
        return closer

    if how == "static":
        return Resource.close_static

    if how == "classmethod":
        return Resource.close_class

    if how == "lambda":
        return lambda: notify("lambda-close")

    if how == "nested":

        def cleanup():
            notify("nested-close")

        return cleanup

    if how == "js":
        return js_cleanup

    if how == "none":
        return None

    # A value that is not callable at all: nothing to run, and nothing to
    # complain about either.
    return [1, 2]


@export
def bump():
    global generation
    generation += 1
</script>

<p data-k="generation">{generation}</p>
