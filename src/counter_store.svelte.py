count = 7
history = []


def increment():
    global count
    count += 1
    history.append(count)


def reset():
    global count, history
    count = 0
    history = []
