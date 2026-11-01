<script lang="python">
# A star import that gives other names, some of which the template reads too, and
# one that shadows a builtin.
from star_given import *

globals()["future"] = 1


def read():
    return future


def read_given():
    return given


@export
def write(value):
    global given
    globals()["future"] = value
    given = value + 1


@export
def add():
    rows.append(len(rows))
</script>

<p data-k="view">{future}|{read()}|{given}|{read_given()}|{rows}</p>
