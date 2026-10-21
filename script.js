const firebaseConfig = {
 apiKey: "AIzaSyC7_YrJbvxm5J3wfnB4eJUnlHv3Lc0txIU",
 authDomain: "aitu-tracker.firebaseapp.com",
 projectId: "aitu-tracker",
 storageBucket: "aitu-tracker.firebasestorage.app",
 messagingSenderId: "100318909623",
 appId: "1:100318909623:web:2d89ea9da5d761b1afe932",
 measurementId: "G-YEQW415HFR"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let tasks = JSON.parse(localStorage.getItem('aitu_tasks')) || [];
let currentUser = null;
let unsubscribeTasks = null;
let unsubscribeSchedule = null;
let currentDate = getToday();
let authMode = 'login';
let toastTimer = null;

const daysOfWeek = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

const defaultSchedule = [
 { day: "Понедельник", classes: [{ time: "-", name: "Самостоятельное обучение", room: "-" }] },
 { day: "Вторник", classes: [
 { time: "08:00-10:00", name: "Иностранный язык 1 (B2)", room: "C1.1.365" },
 { time: "10:00-12:00", name: "Линейная алгебра", room: "C1.3.234" }
 ]},
 { day: "Среда", classes: [
 { time: "08:00-09:00", name: "Линейная алгебра", room: "C1.3.234" },
 { time: "10:00-12:00", name: "Введение в программирование", room: "C1.1.353" },
 { time: "12:00-14:00", name: "Математический анализ", room: "C1.3.365" },
 { time: "20:00-22:00", name: "ИКТ", room: "Онлайн" }
 ]},
 { day: "Четверг", classes: [
 { time: "08:00", name: "Культурология", room: "C1.1.254" },
 { time: "11:00", name: "ИКТ", room: "-" },
 { time: "14:00", name: "Физическая культура (Волейбол)", room: "Спортзал" },
 { time: "20:00", name: "Введение в программирование", room: "Онлайн" }
 ]},
 { day: "Пятница", classes: [
 { time: "08:00", name: "Иностранный язык 1 (B2)", room: "-" },
 { time: "10:00", name: "Культурология", room: "-" },
 { time: "11:00", name: "Введение в программирование", room: "-" },
 { time: "20:00", name: "ИКТ", room: "Онлайн" }
 ]},
 { day: "Суббота", classes: [] },
 { day: "Воскресенье", classes: [] }
];

let scheduleData = JSON.parse(localStorage.getItem('aitu_schedule')) || defaultSchedule;

function init() {
 initTheme();
 updateAuthUI();
 document.getElementById('datePicker').value = currentDate;
 updateDateLabel();
 renderTasks();
 renderSchedule();
}

function getToday() {
 return dateToString(new Date());
}

function dateToString(d) {
 let month = String(d.getMonth() + 1).padStart(2, '0');
 let day = String(d.getDate()).padStart(2, '0');
 return d.getFullYear() + '-' + month + '-' + day;
}

function userDoc() {
 return db.collection('users').doc(currentUser.uid);
}

function saveTasks() {
 if (!currentUser) {
 localStorage.setItem('aitu_tasks', JSON.stringify(tasks));
 }
}

function saveSchedule() {
 if (currentUser) {
 userDoc().collection('settings').doc('schedule').set({ days: scheduleData }).catch(showCloudError);
 } else {
 localStorage.setItem('aitu_schedule', JSON.stringify(scheduleData));
 }
 renderSchedule();
}

function showCloudError(error) {
 console.error('Firebase error:', error);
 alert('Не удалось сохранить в облако: ' + error.message);
}

function startCloudSync() {
 unsubscribeTasks = userDoc().collection('tasks').onSnapshot(function (snapshot) {
 tasks = snapshot.docs.map(function (d) { return d.data(); });
 renderTasks();
 }, showCloudError);

 unsubscribeSchedule = userDoc().collection('settings').doc('schedule').onSnapshot(function (doc) {
 if (doc.exists) {
 scheduleData = doc.data().days;
 } else if (!doc.metadata.fromCache) {
 scheduleData = JSON.parse(JSON.stringify(defaultSchedule));
 doc.ref.set({ days: scheduleData });
 }
 renderSchedule();
 }, showCloudError);
}

function stopCloudSync() {
 if (unsubscribeTasks) unsubscribeTasks();
 if (unsubscribeSchedule) unsubscribeSchedule();
 unsubscribeTasks = null;
 unsubscribeSchedule = null;

 tasks = JSON.parse(localStorage.getItem('aitu_tasks')) || [];
 scheduleData = JSON.parse(localStorage.getItem('aitu_schedule')) || defaultSchedule;
 renderTasks();
 renderSchedule();
}

auth.onAuthStateChanged(function (user) {
 if (user) {
 currentUser = { uid: user.uid, name: user.displayName || user.email, email: user.email };
 startCloudSync();
 } else {
 let wasLoggedIn = (currentUser !== null);
 currentUser = null;
 if (wasLoggedIn) stopCloudSync();
 }
 updateAuthUI();
});

function switchTab(tabId, btn) {
 let contents = document.querySelectorAll('.tab-content');
 let buttons = document.querySelectorAll('.tab-btn');
 contents.forEach(el => el.classList.remove('active'));
 buttons.forEach(el => el.classList.remove('active'));

 document.getElementById('tab-' + tabId).classList.add('active');
 btn.classList.add('active');
}

function setDate(dateStr) {
 if (!dateStr) return;
 currentDate = dateStr;
 updateDateLabel();
 renderTasks();
}

function changeDate(days) {
 let d = new Date(currentDate + 'T00:00:00');
 d.setDate(d.getDate() + days);
 currentDate = dateToString(d);
 document.getElementById('datePicker').value = currentDate;
 updateDateLabel();
 renderTasks();
}

function updateDateLabel() {
 let d = new Date(currentDate + 'T00:00:00');
 let dayName = daysOfWeek[d.getDay()];
 let text = dayName;
 if (currentDate === getToday()) {
 text = text + ' (Сегодня)';
 }
 document.getElementById('dateLabel').innerText = text;
}

function renderTasks() {
 let list = document.getElementById('taskList');
 list.innerHTML = '';

 let dailyTasks = tasks.filter(t => t.date === currentDate);

 if (dailyTasks.length === 0) {
 list.innerHTML = '<div class="empty-state"><img src="images/empty-state.svg" width="64" height="64" alt=""><p>На этот день задач нет. Добавьте новую задачу ниже.</p></div>';
 return;
 }

 dailyTasks.sort((a, b) => (a.time || "24:00").localeCompare(b.time || "24:00"));

 dailyTasks.forEach(task => {
 let item = document.createElement('div');
 item.className = 'task-item' + (task.done ? ' completed' : '');

 item.innerHTML =
 `<input type="checkbox" class="task-checkbox" ${task.done ? 'checked' : ''} onchange="toggleTask('${task.id}')">` +
 `<div class="task-content">` +
 `<div class="task-title">${escapeHTML(task.title)}</div>` +
 `<div class="task-meta">` +
 `<span class="task-subject">${escapeHTML(task.subject)}</span>` +
 (task.time ? `<span>Время: ${task.time}</span>` : '') +
 `</div>` +
 `</div>` +
 `<button class="task-delete" onclick="deleteTask('${task.id}')" title="Удалить">&times;</button>`;

 list.appendChild(item);
 });
}

function addTask(e) {
 e.preventDefault();
 let title = document.getElementById('taskTitle').value.trim();
 let subject = document.getElementById('taskSubject').value;
 let time = document.getElementById('taskTime').value;

 if (!title || !subject) return;

 let newTask = {
 id: Date.now().toString(),
 title: title,
 subject: subject,
 time: time,
 date: currentDate,
 done: false
 };

 if (currentUser) {
 userDoc().collection('tasks').doc(newTask.id).set(newTask).catch(showCloudError);
 } else {
 tasks.push(newTask);
 saveTasks();
 renderTasks();
 }

 document.getElementById('taskTitle').value = '';
 document.getElementById('taskTime').value = '';
}

function showToast(text) {
 let toast = document.getElementById('toast');
 toast.textContent = text;
 toast.classList.add('show');
 clearTimeout(toastTimer);
 toastTimer = setTimeout(function () {
 toast.classList.remove('show');
 }, 2500);
}

function toggleTask(id) {
 let task = tasks.find(t => t.id === id);
 if (!task) return;

 if (!task.done) {
 showToast('Задача выполнена: ' + task.title);
 }

 if (currentUser) {
 userDoc().collection('tasks').doc(id).update({ done: !task.done }).catch(showCloudError);
 } else {
 task.done = !task.done;
 saveTasks();
 renderTasks();
 }
}

function deleteTask(id) {
 if (currentUser) {
 userDoc().collection('tasks').doc(id).delete().catch(showCloudError);
 } else {
 tasks = tasks.filter(t => t.id !== id);
 saveTasks();
 renderTasks();
 }
}

function renderSchedule() {
 let container = document.getElementById('scheduleContainer');
 let html = '';

 scheduleData.forEach((day, dayIndex) => {
 let classesHtml = '';

 if (day.classes.length === 0) {
 classesHtml = '<div class="class-item"><div class="day-off">Выходной</div></div>';
 } else {
 day.classes.forEach((c, classIndex) => {
 classesHtml +=
 '<div class="class-item">' +
 '<div class="class-time">' + escapeHTML(c.time) + '</div>' +
 '<div class="class-name">' + escapeHTML(c.name) + '</div>' +
 '<div class="class-room">' + escapeHTML(c.room) + '</div>' +
 '<button class="class-delete" onclick="deleteScheduleClass(' + dayIndex + ',' + classIndex + ')" title="Удалить">&times;</button>' +
 '</div>';
 });
 }

 html +=
 '<div class="day-card">' +
 '<div class="day-header">' + day.day + '</div>' +
 '<div class="day-body">' + classesHtml + '</div>' +
 '</div>';
 });

 container.innerHTML = html;
}

function addScheduleClass(e) {
 e.preventDefault();
 let dayName = document.getElementById('schedDay').value;
 let name = document.getElementById('schedName').value.trim();
 let room = document.getElementById('schedRoom').value.trim();
 let time = document.getElementById('schedTime').value.trim();

 if (!name || !room || !time) return;

 let dayObj = scheduleData.find(d => d.day === dayName);
 if (dayObj) {
 dayObj.classes.push({ time: time, name: name, room: room });
 saveSchedule();
 }

 document.getElementById('schedName').value = '';
 document.getElementById('schedRoom').value = '';
 document.getElementById('schedTime').value = '';
}

function deleteScheduleClass(dayIndex, classIndex) {
 scheduleData[dayIndex].classes.splice(classIndex, 1);
 saveSchedule();
}

function updateAuthUI() {
 let box = document.getElementById('authContainer');
 if (currentUser) {
 box.innerHTML =
 '<span style="font-weight: bold; font-size: 0.9rem;">' + escapeHTML(currentUser.name) + '</span>' +
 '<button class="btn btn-outline" onclick="logout()">Выйти</button>';
 } else {
 box.innerHTML =
 '<button class="btn btn-outline" onclick="openModal(\'login\')">Войти</button>' +
 '<button class="btn btn-primary" onclick="openModal(\'register\')">Регистрация</button>';
 }
}

function openModal(mode) {
 authMode = mode;
 clearErrors();

 if (mode === 'login') {
 document.getElementById('modalTitle').innerText = 'Вход';
 document.getElementById('authSubmitBtn').innerText = 'Войти';
 document.getElementById('authSwitch').innerText = 'Нет аккаунта? Зарегистрируйтесь';
 document.getElementById('nameGroup').style.display = 'none';
 } else {
 document.getElementById('modalTitle').innerText = 'Регистрация';
 document.getElementById('authSubmitBtn').innerText = 'Зарегистрироваться';
 document.getElementById('authSwitch').innerText = 'Уже есть аккаунт? Войдите';
 document.getElementById('nameGroup').style.display = 'block';
 }

 document.getElementById('authModal').classList.add('active');
}

function closeModal() {
 document.getElementById('authModal').classList.remove('active');
 document.getElementById('authForm').reset();
 document.getElementById('authPassword').type = 'password';
 clearErrors();
}

function toggleAuthMode() {
 openModal(authMode === 'login' ? 'register' : 'login');
}

function togglePassword() {
 let input = document.getElementById('authPassword');
 input.type = (input.type === 'password') ? 'text' : 'password';
}

function showError(boxId, errorId, message) {
 document.getElementById(boxId).classList.add('error');
 document.getElementById(errorId).innerText = message;
}

function clearErrors() {
 ['nameBox', 'emailBox', 'passBox'].forEach(id => document.getElementById(id).classList.remove('error'));
 ['nameError', 'emailError', 'passError'].forEach(id => document.getElementById(id).innerText = '');
}

function handleAuth(e) {
 e.preventDefault();
 clearErrors();

 let name = document.getElementById('authName').value.trim();
 let email = document.getElementById('authEmail').value.trim().toLowerCase();
 let password = document.getElementById('authPassword').value;
 let ok = true;

 if (authMode === 'register' && name === '') {
 showError('nameBox', 'nameError', 'Введите имя');
 ok = false;
 }
 if (email.indexOf('@') === -1 || email.indexOf('.') === -1) {
 showError('emailBox', 'emailError', 'Введите правильный email, например student@aitu.edu.kz');
 ok = false;
 }
 if (password.length < 6) {
 showError('passBox', 'passError', 'Пароль должен быть не короче 6 символов');
 ok = false;
 }
 if (!ok) return;

 let btn = document.getElementById('authSubmitBtn');
 btn.disabled = true;

 let request;
 if (authMode === 'register') {
 request = auth.createUserWithEmailAndPassword(email, password).then(function (cred) {
 return cred.user.updateProfile({ displayName: name }).then(function () {
 if (currentUser) {
 currentUser.name = name;
 updateAuthUI();
 }
 });
 });
 } else {
 request = auth.signInWithEmailAndPassword(email, password);
 }

 request
 .then(function () { closeModal(); })
 .catch(showAuthError)
 .then(function () { btn.disabled = false; });
}

function showAuthError(error) {
 let code = error.code;
 if (code === 'auth/email-already-in-use') {
 showError('emailBox', 'emailError', 'Этот email уже зарегистрирован');
 } else if (code === 'auth/invalid-email') {
 showError('emailBox', 'emailError', 'Введите правильный email');
 } else if (code === 'auth/weak-password') {
 showError('passBox', 'passError', 'Слишком простой пароль, минимум 6 символов');
 } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
 showError('passBox', 'passError', 'Неверный email или пароль');
 } else if (code === 'auth/network-request-failed') {
 showError('passBox', 'passError', 'Нет интернета, попробуйте ещё раз');
 } else if (code === 'auth/too-many-requests') {
 showError('passBox', 'passError', 'Слишком много попыток, подождите немного');
 } else {
 showError('passBox', 'passError', 'Ошибка: ' + code);
 }
}

function logout() {
 auth.signOut();
}

function initTheme() {
 if (localStorage.getItem('aitu_theme') === 'dark') {
 document.documentElement.setAttribute('data-theme', 'dark');
 }

 document.getElementById('themeToggle').addEventListener('click', function () {
 let now = document.documentElement.getAttribute('data-theme');
 let next = (now === 'dark') ? 'light' : 'dark';
 document.documentElement.setAttribute('data-theme', next);
 localStorage.setItem('aitu_theme', next);
 });
}

function escapeHTML(str) {
 return String(str).replace(/[&<>'"]/g, function (c) {
 return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c];
 });
}

window.onload = init;