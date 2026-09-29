<script lang="python">
# A lookup table of rows, and a handler that updates every row once: "mark all
# as read".
kind: str = "dict"
n: int = 10000
rows = {i: {"read": False} for i in range(n)} if kind == "dict" else [{"read": False} for i in range(n)]


def mark_all():
    for row in (rows.values() if kind == "dict" else rows):
        row["read"] = True


def count():
    return sum(1 for row in (rows.values() if kind == "dict" else rows) if row["read"])
</script>

<button onclick={mark_all}>mark all</button>
<p>{count()}</p>
