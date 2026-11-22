# Each kind of binding made while globals() is walked, from a function by
# `global` and at the top of the module: what CPython raises for each, or "ok".
# `python3` runs this file as it is.
__all__ = ["seen"]

seen = []
existing = 1
doomed = 1


def attempt(label, walk):
    try:
        walk()
        seen.append(label + " ok")
    except RuntimeError:
        seen.append(label + " RuntimeError")


def bind_variable():
    global fresh_variable
    for name in globals():
        fresh_variable = 1


def bind_class():
    global FreshClass
    for name in globals():
        class FreshClass:
            pass


def bind_function():
    global fresh_function
    for name in globals():
        def fresh_function():
            pass


def bind_existing():
    global existing
    for name in globals():
        existing = 2


def delete_name():
    global doomed
    for name in globals():
        del doomed


attempt("variable", bind_variable)
attempt("class", bind_class)
attempt("function", bind_function)
attempt("existing", bind_existing)
attempt("delete", delete_name)

walker = None
try:
    for walker in globals():
        class TopClass:
            pass
    seen.append("top class ok")
except RuntimeError:
    seen.append("top class RuntimeError")
try:
    for walker in globals():
        top_variable = 1
    seen.append("top variable ok")
except RuntimeError:
    seen.append("top variable RuntimeError")

if __name__ == "__main__":
    print(seen)
