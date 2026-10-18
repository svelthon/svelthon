# Lists and tuples compare their items from the first, up to the first that
# differs: what each comparison asked, as `python3` answers on this module.
__all__ = ["answers"]


def answers():
    seen = []

    class Logged:
        def __eq__(self, other):
            seen.append(self)
            return True

    first, second = Logged(), Logged()
    pair = (1, Logged()) == (2, Logged())
    asked = len(seen)
    both = [first, second] == [1, 2]

    return [str(pair), str(asked), str(both), str(seen == [first, second] and seen[0] is first)]


if __name__ == "__main__":
    print(answers())
