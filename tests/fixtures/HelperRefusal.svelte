<script lang="python">
# A column that is sometimes empty is the ordinary way to reach these: the value
# is None, and None is not a date.
when = None
size = 0
rows = [1, 2, 3]


@export
def show_date():
    return date(when)


@export
def show_fromnow():
    return fromnow(when)


@export
def show_batch():
    return batch(rows, size)
</script>

<p data-k="ok">{date("2026-09-10", "medium", None, "en-GB")}</p>
