<script lang="python">
# A column that is sometimes empty is the ordinary way to reach these: the value
# is None, and None is not a date.
when = None


@export
def show_date():
    return date(when)


@export
def show_from_now():
    return from_now(when)
</script>

<p data-k="ok">{date("2026-09-10", "medium", None, "en-GB")}</p>
