<script lang="python">
count = 1


def write_into(names):
    try:
        names["count"] = 2
        return "written"
    except TypeError:
        return "refused"


def through_frame():
    try:
        raise ValueError()
    except ValueError as error:
        return write_into(error.__traceback__.tb_frame.f_globals)


said = write_into(globals())
framed = through_frame()
read = globals()["count"]
</script>

<p data-k="view">{said}|{framed}|{read}|{count}</p>
