<script lang="python">
# Containers a component owns through its props' defaults, bindable or not,
# and names deleted with `del`.
rows: list = bindable([])
table: dict = bindable({})
nested: dict = {"a": []}
count = 3
len = 42


def label():
    return 1


@export
def present():
    return "count" in globals()


@export
def delete_and_ask():
    global count
    del count
    try:
        return "count" in globals()
    finally:
        count = 3


@export
def delete_shadow():
    global len
    del len
    return str(len([1, 2]))


@export
def delete_then_loop():
    global count
    del count
    for count in [9]:
        pass
    return "count" in globals()


@export
def set_count(value):
    global count
    count = value


@export
def delete_then_augment():
    global count
    del count
    try:
        count += 1
        return "no error"
    except NameError:
        return "NameError"
    finally:
        count = 3


@export
def snapshot():
    return f"{rows}|{table}|{type(rows).__name__}"


@export
def mutate():
    rows.append(1)
    table["k"] = 2
    nested["a"].append(9)


@export
def reassign():
    global rows
    rows = [5]


@export
def delete_then_rebind():
    global count
    del count
    try:
        count
        first = "present"
    except NameError:
        first = "missing"
    count = 7
    return first


@export
def delete_twice():
    global count
    del count
    try:
        del count
        return "no error"
    except NameError:
        return "NameError"
    finally:
        count = 3


@export
def delete_function():
    global label
    del label
    try:
        label()
        return "present"
    except NameError:
        return "missing"
</script>

<p data-k="rows">{rows}</p>
<p data-k="table">{table}</p>
<p data-k="nested">{nested["a"]}</p>
<p data-k="count">{count}</p>
