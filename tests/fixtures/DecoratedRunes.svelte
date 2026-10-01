<script lang="python">
# A derived and an effect whose decorator hands back a callable instance or a
# bound method: called the way Python calls them, and still reactive.
class Callback:
    def __init__(self, fn):
        self.fn = fn

    def __call__(self):
        return self.fn()


def as_instance(fn):
    return Callback(fn)


def as_method(fn):
    return Callback(fn).__call__


count = 1
seen = 0


@derived
@as_instance
def doubled():
    return count * 2


@derived
@as_method
def tripled():
    return count * 3


@effect
@as_instance
def watch():
    global seen
    seen = count


def bump():
    global count
    count += 1
</script>

<button data-k="bump" onclick={bump}>bump</button>
<p data-k="seen">{doubled} {tripled} {seen}</p>
