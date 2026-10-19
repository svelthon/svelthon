# repr() of containers nested deeper than the recursion limit, as deep as
# the stack takes them, and one too deep for it, which raises and leaves
# nothing marked as being represented: what each answered, as `python3`
# answers on this module.
__all__ = ["answers"]


def answers():
    x = []
    for _ in range(1500):
        x = [x]
    shallow = repr(x) == "[" * 1501 + "]" * 1501

    deep = []
    for _ in range(100000):
        deep = [deep]
    try:
        repr(deep)
        raised = "nothing"
    except RecursionError:
        raised = "RecursionError"
    deep[0][0] = []

    return [str(shallow), raised, repr(deep)]


if __name__ == "__main__":
    print(answers())
