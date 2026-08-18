count = 0
history = []


def increment():
    global count
    count += 1
    history.append(count)
    publish("history")


def reset():
    global count, history
    count = 0
    history = []
