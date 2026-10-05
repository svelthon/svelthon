# `to_py` on a value that is already Python, beside a JavaScript object it does
# convert.
__all__ = ["kept", "converted"]


def kept(key):
    source = {key: 42}
    result = to_py(source)
    result["extra"] = 1
    return [result is source, key in result, "extra" in source]


def converted():
    row = to_py(js.JSON.parse('{"answer": 42}'))
    return [type(row).__name__, row.get("answer")]
