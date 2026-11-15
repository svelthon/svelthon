"""A store holding instances in a list and a dict, and a set, bytes and a range."""


class Todo:
    def __init__(self, title):
        self.title = title
        self.done = False

    def toggle(self):
        self.done = not self.done
        return self.done

    def __str__(self):
        return f"Todo {self.title}"


todos = [Todo("a"), Todo("b")]
by_id = {"x": Todo("x")}
tags = {1, 2}
raw = b"ab"
span = range(3)


def add(title):
    todos.append(Todo(title))
