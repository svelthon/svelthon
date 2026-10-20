// A component using every form Brython names with a generated number: a
// function, a decorator, a lambda, a comprehension and a class.
export const SOURCE = `count = 0
double = lambda n: n * 2


class Step:
    size = 1


def increment():
    global count
    count += Step.size


@effect
def log():
    print([double(n) for n in range(count)])
`;
