<script lang="python">
def collect(fn):
    # Answers a function of a different signature, which is what an ordinary
    # decorator does: the name keeps its spelling and stops holding the `def`.
    def wrapped(*values):
        return len(values)

    return wrapped


class Doubler:
    def __call__(self, value):
        return value * 2


def as_object(fn):
    return Doubler()


@export
@collect
def decorated(value):
    return value


@export
@as_object
def as_object_decorated(value):
    return value


@export
def from_python():
    # What Python itself does with the same name, which is the reference the
    # export has to match.
    return decorated(10, 20, 30)
</script>

<p data-k="ready">ready</p>
