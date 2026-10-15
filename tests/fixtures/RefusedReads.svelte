<script lang="python">
# A dict read by `get`, once per key, while the template renders, where a write
# would be refused; or written once per key in ways that change nothing:
# `setdefault` of a key it holds, a key set to the value it holds, and a set
# given a member it holds.
importjs { watch, start } from "./enumerated.js"
kind: str = "get"
n: int = 50
table = {str(i): i for i in range(n)}
numbers = {i: i for i in range(n)}
members = {i for i in range(n)}
watch(members if kind == "add" else numbers if kind in ("setdefault", "same value") else table)


def total():
    start()
    result = 0
    for i in range(n):
        if kind == "get":
            result += table.get(str(i))
        elif kind == "setdefault":
            result += numbers.setdefault(i, 0)
        elif kind == "same value":
            numbers[i] = numbers[i]
            result += numbers[i]
        else:
            members.add(i)
            result += i
    return result
</script>

<output>{total()}</output>
