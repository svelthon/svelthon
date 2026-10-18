# A dict whose key is None, handed to JavaScript through its view, as a copy and
# as JSON.
__js__ = {"./none_keys_tools.js": ["keys_of"]}

mapping = {None: 1}


def viewed():
    return keys_of(mapping)


def copied():
    return to_js(mapping)


def serialised():
    return tojson(mapping)
