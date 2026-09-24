document.addEventListener('DOMContentLoaded', () => {
    const todoForm = document.getElementById('todoForm');
    const todoInput = document.getElementById('todoInput');
    const todoList = document.getElementById('todoList');
    const emptyMessage = document.getElementById('emptyMessage');

    let todos = JSON.parse(localStorage.getItem('todos')) || [];

    const saveTodos = () => {
        localStorage.setItem('todos', JSON.stringify(todos));
        updateEmptyMessage();
    };

    const updateEmptyMessage = () => {
        emptyMessage.style.display = todos.length === 0 ? 'block' : 'none';
    };

    const createTodoElement = (todo) => {
        const li = document.createElement('li');
        li.className = 'todo-item';
        li.dataset.id = todo.id;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'todo-checkbox';
        checkbox.checked = todo.completed;

        const span = document.createElement('span');
        span.className = `todo-text ${todo.completed ? 'completed' : ''}`;
        span.textContent = todo.text;

        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-button';
        deleteButton.textContent = '×';

        li.appendChild(checkbox);
        li.appendChild(span);
        li.appendChild(deleteButton);

        return li;
    };

    const animateReorder = () => {
        const oldPositions = new Map();
        [...todoList.children].forEach(item => {
            const id = parseInt(item.dataset.id);
            if (!isNaN(id)) {
                oldPositions.set(id, item.getBoundingClientRect());
            }
        });

        sortTodos();

        todos.forEach(todo => {
            const item = todoList.querySelector(`[data-id="${todo.id}"]`);
            if (item) {
                todoList.appendChild(item);
            }
        });

        todos.forEach(todo => {
            const item = todoList.querySelector(`[data-id="${todo.id}"]`);
            const oldPos = oldPositions.get(todo.id);
            if (item && oldPos) {
                const newPos = item.getBoundingClientRect();
                const deltaY = oldPos.top - newPos.top;

                if (deltaY !== 0) {
                    item.style.transition = 'none';
                    item.style.transform = `translateY(${deltaY}px)`;
                    item.offsetHeight;
                    requestAnimationFrame(() => {
                        item.style.transition = 'transform 0.4s ease';
                        item.style.transform = '';
                        item.addEventListener('transitionend', () => {
                            item.style.transition = '';
                        }, { once: true });
                    });
                }
            }
        });
    };

    const sortTodos = () => {
        todos.sort((a, b) => {
            if (a.completed === b.completed) return 0;
            return a.completed ? 1 : -1;
        });
    };

    const renderTodos = () => {
        sortTodos();
        const fragment = document.createDocumentFragment();
        todoList.innerHTML = '';

        todos.forEach(todo => {
            const element = createTodoElement(todo);
            fragment.appendChild(element);
        });

        todoList.appendChild(fragment);
        updateEmptyMessage();
    };

    todoForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = todoInput.value.trim();

        if (text) {
            const todo = {
                id: Date.now(),
                text: text,
                completed: false
            };

            todos.push(todo);
            saveTodos();
            renderTodos();
            todoInput.value = '';
        }
    });

    todoList.addEventListener('click', (e) => {
        const li = e.target.closest('.todo-item');
        if (!li) return;

        const todoId = parseInt(li.dataset.id);
        const todoIndex = todos.findIndex(t => t.id === todoId);

        if (e.target.classList.contains('delete-button')) {
            todos.splice(todoIndex, 1);
            saveTodos();
            renderTodos();
        } else if (e.target.classList.contains('todo-checkbox')) {
            todos[todoIndex].completed = e.target.checked;
            const textSpan = li.querySelector('.todo-text');
            if (textSpan) {
                textSpan.classList.toggle('completed', e.target.checked);
            }
            saveTodos();
            animateReorder();
        }
    });

    renderTodos();
});


