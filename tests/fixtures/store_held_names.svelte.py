# Names a store's module has, and names it has not: only annotated, deleted,
# bound in a comprehension of its own.
note: int
deleted = 1
del deleted
squares = [last := value for value in range(2)]
kept = 1
