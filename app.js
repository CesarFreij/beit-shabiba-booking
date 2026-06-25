import { BOOKING_PASSWORD, ROOMS, WEEKDAYS } from './config.js';

let firebaseSetup;

try {
  firebaseSetup = await import('./firebase-config.js');
} catch (e) {
  console.error('Firebase config import failed:', e);
  hideLoading();
  showFatalError('فشل تحميل إعدادات Firebase');
  throw e;
}
const firebaseConfig = firebaseSetup?.firebaseConfig || null;
const firebaseAppModule = await import('https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js');
const firestoreModule = await import('https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js');

const {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  runTransaction,
  deleteDoc,
  serverTimestamp,
  getDocs,
  Timestamp,
} = firestoreModule;

const { initializeApp } = firebaseAppModule;

let db;
let selectedDate = new Date();
let currentYear = selectedDate.getFullYear();
let currentMonth = selectedDate.getMonth();
let selectedRoom = ROOMS[0].id;
let monthBookings = {};
let selectedDayBookings = [];
let myBookings = [];
let unsubscribeDay = null;
let unsubscribeMine = null;
const deviceId = getDeviceId();
const app = firebaseAppModule.initializeApp(firebaseConfig);
db = getFirestore(app);

const elements = {
  loadingOverlay: document.getElementById('loadingOverlay'),
  bookingGate: document.getElementById('bookingGate'),
  appShell: document.getElementById('appShell'),
  confirmAccess: document.getElementById('confirmAccess'),
  toggleTheme: document.getElementById('toggleTheme'),
  bookingPassword: document.getElementById('bookingPassword'),
  monthTitle: document.getElementById('monthTitle'),
  calendarGrid: document.getElementById('calendarGrid'),
  selectedDayTitle: document.getElementById('selectedDayTitle'),
  roomTabs: document.getElementById('roomTabs'),
  timelineGrid: document.getElementById('timelineGrid'),
  roomSelect: document.getElementById('roomSelect'),
  bookingForm: document.getElementById('bookingForm'),
  groupName: document.getElementById('groupName'),
  leaderName: document.getElementById('leaderName'),
  phoneInput: document.getElementById('phoneInput'),
  bookingDate: document.getElementById('bookingDate'),
  startTime: document.getElementById('startTime'),
  endTime: document.getElementById('endTime'),
  notesInput: document.getElementById('notesInput'),
  durationLabel: document.getElementById('durationLabel'),
  repeatWeekly: document.getElementById('repeatWeekly'),
  repeatSection: document.getElementById('repeatSection'),
  repeatDay: document.getElementById('repeatDay'),
  repeatFrom: document.getElementById('repeatFrom'),
  repeatTo: document.getElementById('repeatTo'),
  myBookingsList: document.getElementById('myBookingsList'),
  alertBox: document.getElementById('alertBox'),
  prevMonth: document.getElementById('prevMonth'),
  nextMonth: document.getElementById('nextMonth'),
  todayButton: document.getElementById('todayButton'),
  showUsage: document.getElementById('showUsage'),
  usageModal: document.getElementById('usageModal'),
  closeUsage: document.getElementById('closeUsage'),
  closeUsageAction: document.getElementById('closeUsageAction'),
};

showLoading();
if (!firebaseConfig) {
  hideLoading();
  showFatalError('يرجى إنشاء ملف firebase-config.js بناءً على firebase-config.js.example وإضافة إعدادات Firebase الخاصة بك.');
} else {
  initFirebase();
}

function initFirebase() {
  const app = firebaseAppModule.initializeApp(firebaseConfig);
  db = getFirestore(app);
  bindEvents();
  preparePage();
  hideLoading();
}

function bindEvents() {
  elements.confirmAccess.addEventListener('click', handleAccess);
  elements.prevMonth.addEventListener('click', () => changeMonth(-1));
  elements.nextMonth.addEventListener('click', () => changeMonth(1));
  elements.todayButton.addEventListener('click', () => goToToday());
  elements.bookingForm.addEventListener('submit', handleBookingSubmit);
  elements.startTime.addEventListener('input', updateDuration);
  elements.endTime.addEventListener('input', updateDuration);
  elements.repeatWeekly.addEventListener('change', toggleRepeatSection);
  elements.showUsage.addEventListener('click', () => toggleModal(true));
  elements.closeUsage.addEventListener('click', () => toggleModal(false));
  elements.closeUsageAction.addEventListener('click', () => toggleModal(false));
  elements.toggleTheme.addEventListener('click', toggleThemeMode);
}

function showLoading() {
  elements.loadingOverlay?.classList.remove('hidden');
}

function hideLoading() {
  elements.loadingOverlay?.classList.add('hidden');
}

function toggleThemeMode() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('youthHouseTheme', isDark ? 'dark' : 'light');
}

function loadThemeMode() {
  const stored = localStorage.getItem('youthHouseTheme');
  if (stored === 'dark') {
    document.body.classList.add('dark-mode');
  }
}

function preparePage() {
  populateRoomSelect();
  populateRepeatDays();
  setInitialDates();
  loadThemeMode();
  renderRoomTabs();
  renderMonth();
  authorizeGate();
}

function authorizeGate() {
  const passed = localStorage.getItem('youthHouseGate') === 'passed';
  if (passed) {
    unlockApp();
  }
}

function handleAccess() {
  const value = elements.bookingPassword.value.trim();
  if (value === BOOKING_PASSWORD) {
    localStorage.setItem('youthHouseGate', 'passed');
    unlockApp();
  } else {
    showAlert('كلمة المرور غير صحيحة. حاول مرة أخرى.', 'error');
  }
}

function unlockApp() {
  elements.bookingGate.classList.add('hidden');
  elements.appShell.classList.remove('hidden');
  elements.alertBox.classList.add('hidden');
  loadMonthBookings();
  subscribeDayBookings();
  subscribeMyBookings();
  renderSelectedDay();
}

function populateRoomSelect() {
  ROOMS.forEach(room => {
    const option = document.createElement('option');
    option.value = room.id;
    option.textContent = room.label;
    elements.roomSelect.appendChild(option);

    const roomTab = document.createElement('button');
    roomTab.type = 'button';
    roomTab.className = 'room-tab';
    roomTab.dataset.room = room.id;
    roomTab.textContent = room.label;
    roomTab.addEventListener('click', () => changeRoom(room.id));
    elements.roomTabs.appendChild(roomTab);
  });
  elements.roomSelect.value = selectedRoom;
  elements.roomSelect.addEventListener('change', () => changeRoom(elements.roomSelect.value));
}

function populateRepeatDays() {
  WEEKDAYS.forEach((day, idx) => {
    const option = document.createElement('option');
    option.value = idx;
    option.textContent = day;
    elements.repeatDay.appendChild(option);
  });
}

function setInitialDates() {
  const today = new Date();
  elements.bookingDate.value = formatDate(today);
  elements.repeatFrom.value = formatDate(today);
  elements.repeatTo.value = formatDate(today);
  elements.startTime.value = '09:00';
  elements.endTime.value = '10:00';
  updateDuration();
}

function renderRoomTabs() {
  Array.from(elements.roomTabs.children).forEach(tab => {
    tab.classList.toggle('active', tab.dataset.room === selectedRoom);
  });
}

function changeRoom(roomId) {
  selectedRoom = roomId;
  elements.roomSelect.value = roomId;
  renderRoomTabs();
  renderTimeline();
}

function changeMonth(offset) {
  currentMonth += offset;
  if (currentMonth < 0) {
    currentYear -= 1;
    currentMonth = 11;
  } else if (currentMonth > 11) {
    currentYear += 1;
    currentMonth = 0;
  }
  renderMonth();
  loadMonthBookings();
}

function goToToday() {
  const now = new Date();
  selectedDate = now;
  currentYear = now.getFullYear();
  currentMonth = now.getMonth();
  renderMonth();
  setSelectedDate(now);
  loadMonthBookings();
}

function renderMonth() {
  const monthName = selectedDate.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
  elements.monthTitle.textContent = monthName;
  renderCalendar();
}

function renderCalendar() {
  elements.calendarGrid.innerHTML = '';
  const firstOfMonth = new Date(currentYear, currentMonth, 1);
  const firstDayIndex = firstOfMonth.getDay();
  const monthLength = new Date(currentYear, currentMonth + 1, 0).getDate();
  const prevMonthDays = firstDayIndex;

  for (let idx = 0; idx < prevMonthDays; idx += 1) {
    const empty = document.createElement('div');
    empty.className = 'calendar-day past';
    elements.calendarGrid.appendChild(empty);
  }

  for (let day = 1; day <= monthLength; day += 1) {
    const date = new Date(currentYear, currentMonth, day);
    const dateString = formatDate(date);
    const bookingCount = monthBookings[dateString] || 0;
    const isSelected = formatDate(selectedDate) === dateString;
    const isPast = date < startOfDay(new Date());

    const dayCard = document.createElement('button');
    dayCard.type = 'button';
    dayCard.className = `calendar-day${isSelected ? ' active' : ''}${isPast ? ' past' : ''}`;
    dayCard.innerHTML = `
      <span class="day-number">${day}</span>
      <span class="day-note">${WEEKDAYS[date.getDay()]}</span>
      <span class="day-note">${bookingCount} حجز</span>
    `;
    dayCard.addEventListener('click', () => setSelectedDate(date));
    elements.calendarGrid.appendChild(dayCard);
  }
}

function setSelectedDate(date) {
  selectedDate = date;
  elements.bookingDate.value = formatDate(date);
  renderMonth();
  renderSelectedDay();
  subscribeDayBookings();
}

function renderSelectedDay() {
  elements.selectedDayTitle.textContent = selectedDate.toLocaleDateString('ar-EG', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  renderTimeline();
}

function subscribeDayBookings() {
  if (unsubscribeDay) unsubscribeDay();
  const dayString = formatDate(selectedDate);
  const dayQuery = query(collection(db, 'bookings'), where('date', '==', dayString), orderBy('startTime'));
  unsubscribeDay = onSnapshot(dayQuery, snapshot => {
    selectedDayBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderTimeline();
  });
}

function subscribeMyBookings() {
  if (unsubscribeMine) unsubscribeMine();
  const mineQuery = query(collection(db, 'bookings'), where('createdByDeviceId', '==', deviceId), orderBy('date'), orderBy('startTime'));
  unsubscribeMine = onSnapshot(mineQuery, snapshot => {
    myBookings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderMyBookings();
  });
}

function renderTimeline() {
  elements.timelineGrid.innerHTML = '';
  const today = startOfDay(new Date());
  const selectedDayStart = startOfDay(selectedDate);
  const now = new Date();
  const currentHour = now.getHours();
  const isCurrentDay = formatDate(selectedDayStart) === formatDate(today);
  const roomBookings = selectedDayBookings.filter(book => book.room === selectedRoom);

  for (let hour = 0; hour < 24; hour += 1) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'timeline-cell';
    const hourText = `${hour.toString().padStart(2, '0')}:00`;
    const hourEndText = `${(hour + 1).toString().padStart(2, '0')}:00`;
    const cellTime = `${hourText} - ${hourEndText}`;

    const isPast = selectedDayStart < today || (isCurrentDay && hour < currentHour);
    const conflictBooking = roomBookings.find(booking => isOverlap(hour, hour + 1, booking.startTime, booking.endTime));

    if (isPast) {
      cell.classList.add('past');
      cell.innerHTML = `<span class="timeline-time">${cellTime}</span><span class="timeline-status">انتهى</span>`;
    } else if (conflictBooking) {
      cell.classList.add('booked');
      cell.innerHTML = `<span class="timeline-time">${cellTime}</span><span class="timeline-status">محجوز</span><span class="timeline-booking">${conflictBooking.groupName} - ${conflictBooking.leaderName}</span>`;
    } else {
      cell.classList.add('available');
      cell.innerHTML = `<span class="timeline-time">${cellTime}</span><span class="timeline-status">متاح</span>`;
      cell.addEventListener('click', () => selectHour(hour));
    }

    elements.timelineGrid.appendChild(cell);
  }
}

function isOverlap(hourStart, hourEnd, startTime, endTime) {
  const bookingStart = timeToMinutes(startTime);
  const bookingEnd = timeToMinutes(endTime);
  const cellStart = hourStart * 60;
  const cellEnd = hourEnd * 60;
  return cellStart < bookingEnd && cellEnd > bookingStart;
}

function selectHour(hour) {
  elements.startTime.value = `${hour.toString().padStart(2, '0')}:00`;
  const nextHour = hour === 23 ? '23:59' : `${(hour + 1).toString().padStart(2, '0')}:00`;
  if (elements.endTime.value <= elements.startTime.value) {
    elements.endTime.value = nextHour;
  }
  updateDuration();
  showAlert('تم اختيار وقت البداية. أكمل تعبئة النموذج ثم أرسل الحجز.', 'success');
}

function updateDuration() {
  const start = elements.startTime.value;
  const end = elements.endTime.value;
  if (!start || !end) {
    elements.durationLabel.textContent = 'لم يتم الاختيار بعد';
    return;
  }
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (endMinutes <= startMinutes) {
    elements.durationLabel.textContent = 'وقت النهاية يجب أن يكون بعد البداية';
    return;
  }
  const diff = endMinutes - startMinutes;
  const hours = Math.floor(diff / 60);
  const minutes = diff % 60;
  elements.durationLabel.textContent = `${hours > 0 ? hours + ' ساعة' : ''}${minutes > 0 ? ' ' + minutes + ' دقيقة' : ''}`.trim();
}

function toggleRepeatSection() {
  elements.repeatSection.classList.toggle('hidden', !elements.repeatWeekly.checked);
}

async function handleBookingSubmit(event) {
  event.preventDefault();
  clearAlert();

  const bookingData = collectBookingData();
  if (!bookingData) return;

  try {
    showTemporaryMessage('جارٍ حفظ الحجز...', 'success');
    await saveBooking(bookingData);
    showAlert('تم حفظ الحجز بنجاح. يظهر الآن في الجدول للجميع.', 'success');
    elements.bookingForm.reset();
    setInitialDates();
    elements.repeatSection.classList.add('hidden');
  } catch (error) {
  console.error('Booking save error:', error);
  console.error('Error code:', error.code);
  console.error('Error message:', error.message);

  showAlert(
  `فشل حفظ الحجز: ${error.code || ''} ${error.message || 'حاول مرة أخرى.'}`,
  'error'
  );
  }
}

function collectBookingData() {
  const groupName = elements.groupName.value.trim();
  const leaderName = elements.leaderName.value.trim();
  const phone = elements.phoneInput.value.trim();
  const date = elements.bookingDate.value;
  const startTime = elements.startTime.value;
  const endTime = elements.endTime.value;
  const notes = elements.notesInput.value.trim();
  const room = elements.roomSelect.value;
  const repeatWeekly = elements.repeatWeekly.checked;

  if (!groupName || !leaderName || !phone || !date || !startTime || !endTime || !room) {
    showAlert('يرجى تعبئة جميع الحقول المطلوبة قبل الإرسال.', 'error');
    return null;
  }
  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    showAlert('وقت النهاية يجب أن يكون بعد وقت البداية.', 'error');
    return null;
  }

  if (repeatWeekly) {
    const repeatFrom = elements.repeatFrom.value;
    const repeatTo = elements.repeatTo.value;
    const repeatDay = elements.repeatDay.value;
    if (!repeatFrom || !repeatTo || repeatDay === '') {
      showAlert('يرجى تحديد بيانات التكرار الأسبوعي بشكل كامل.', 'error');
      return null;
    }
    if (repeatTo < repeatFrom) {
      showAlert('تاريخ نهاية التكرار يجب أن يكون بعد تاريخ البداية.', 'error');
      return null;
    }

    const recurringDates = buildRecurringDates(parseInt(repeatDay, 10), repeatFrom, repeatTo);
    if (recurringDates.length === 0) {
      showAlert('لا يوجد تواريخ متاحة ضمن نطاق التكرار المحدد.', 'error');
      return null;
    }

    return {
      groupName,
      leaderName,
      phone,
      notes,
      room,
      startTime,
      endTime,
      recurring: true,
      recurringDates,
      repeatFrom,
      repeatTo,
      repeatDayLabel: WEEKDAYS[parseInt(repeatDay, 10)],
    };
  }

  return {
    groupName,
    leaderName,
    phone,
    notes,
    room,
    startTime,
    endTime,
    recurring: false,
    date,
  };
}

function buildRecurringDates(weekdayIndex, from, to) {
  const dates = [];
  const start = new Date(from);
  const end = new Date(to);
  let current = new Date(start);
  while (current.getDay() !== weekdayIndex) {
    current.setDate(current.getDate() + 1);
  }
  while (current <= end) {
    dates.push(formatDate(current));
    current.setDate(current.getDate() + 7);
  }
  return dates;
}

async function saveBooking(data) {
  const seriesId = data.recurring ? `series-${Date.now()}` : null;
  const newBookings = data.recurring
    ? data.recurringDates.map(date => createBookingPayload(date, data, seriesId))
    : [createBookingPayload(data.date, data, seriesId)];

  await runTransaction(db, async (tx) => {
    for (const booking of newBookings) {
      const queryRef = query(
      collection(db, 'bookings'),
      where('room', '==', booking.room),
      where('date', '==', booking.date)
    );

    const snapshot = await getDocs(queryRef);

    snapshot.forEach(docSnap => {
      const existing = docSnap.data();
      if (hasOverlap(booking, existing)) {
        throw new Error(`هذا الوقت محجوز بالفعل في ${booking.date}. الرجاء اختيار وقت آخر.`);
      }
    });
  }

    for (const booking of newBookings) {
      const newId = doc(collection(db, 'bookings')).id;
      const bookingRef = doc(db, 'bookings', newId);
      tx.set(bookingRef, { ...booking, id: newId });
    }
  });

  await addDoc(collection(db, 'notifications'), {
    type: 'booking',
    message: data.recurring
      ? `حجز أسبوعي جديد في ${getRoomLabel(data.room)} من ${data.repeatFrom} إلى ${data.repeatTo}`
      : `حجز جديد في ${getRoomLabel(data.room)} يوم ${data.date} من ${data.startTime} إلى ${data.endTime}`,
    bookingId: newBookings[0].id || null,
    createdAt: serverTimestamp(),
    read: false,
  });
}

function createBookingPayload(date, data, seriesId) {
  return {
    room: data.room,
    date,
    startTime: data.startTime,
    endTime: data.endTime,
    groupName: data.groupName,
    leaderName: data.leaderName,
    phone: data.phone,
    notes: data.notes || '',
    createdAt: serverTimestamp(),
    createdByDeviceId: deviceId,
    isRecurring: data.recurring,
    recurringSeriesId: seriesId,
  };
}

function hasOverlap(newBooking, existing) {
  const startA = timeToMinutes(newBooking.startTime);
  const endA = timeToMinutes(newBooking.endTime);
  const startB = timeToMinutes(existing.startTime);
  const endB = timeToMinutes(existing.endTime);
  return startA < endB && endA > startB;
}

function getRoomLabel(roomId) {
  return ROOMS.find(room => room.id === roomId)?.label || roomId;
}

async function loadMonthBookings() {
  const first = new Date(currentYear, currentMonth, 1);
  const last = new Date(currentYear, currentMonth + 1, 0);
  const start = formatDate(first);
  const end = formatDate(last);
  const monthQuery = query(collection(db, 'bookings'), where('date', '>=', start), where('date', '<=', end));
  const snapshot = await getDocs(monthQuery);
  monthBookings = {};
  snapshot.docs.forEach(docSnap => {
    const data = docSnap.data();
    monthBookings[data.date] = (monthBookings[data.date] || 0) + 1;
  });
  renderCalendar();
}

function renderMyBookings() {
  elements.myBookingsList.innerHTML = '';
  if (myBookings.length === 0) {
    elements.myBookingsList.innerHTML = '<p class="day-note">لا توجد حجوزات قمت بها على هذا الجهاز.</p>';
    return;
  }
  myBookings.forEach(book => {
    const item = document.createElement('div');
    item.className = 'booking-item';
    item.innerHTML = `
      <strong>${book.groupName} - ${getRoomLabel(book.room)}</strong>
      <p>المسؤول: ${book.leaderName}</p>
      <p>الهاتف: ${book.phone}</p>
      <p>التاريخ: ${book.date}</p>
      <p>الوقت: ${book.startTime} - ${book.endTime}</p>
      <p>${book.notes || ''}</p>
      <div class="booking-actions">
        <button type="button" class="btn-secondary" data-id="${book.id}">إلغاء الحجز</button>
      </div>
    `;
    const cancelBtn = item.querySelector('button');
    cancelBtn.addEventListener('click', () => cancelBooking(book.id));
    elements.myBookingsList.appendChild(item);
  });
}

async function cancelBooking(bookingId) {
  const confirmed = confirm('هل أنت متأكد أنك تريد إلغاء هذا الحجز؟');
  if (!confirmed) return;
  try {
    await deleteDoc(doc(db, 'bookings', bookingId));
    showAlert('تم إلغاء الحجز بنجاح.', 'success');
  } catch (error) {
    showAlert('حدث خطأ أثناء إلغاء الحجز. حاول مرة أخرى.', 'error');
  }
}

function timeToMinutes(value) {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDeviceId() {
  const key = 'youthHouseDeviceId';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `device-${Math.random().toString(36).slice(2, 12)}-${Date.now()}`;
    localStorage.setItem(key, id);
  }
  return id;
}

function showAlert(message, type = 'success') {
  elements.alertBox.className = `alert-box ${type}`;
  elements.alertBox.textContent = message;
  elements.alertBox.classList.remove('hidden');
}

function clearAlert() {
  elements.alertBox.classList.add('hidden');
  elements.alertBox.textContent = '';
}

function showFatalError(message) {
  elements.alertBox.className = 'alert-box error';
  elements.alertBox.textContent = message;
  elements.alertBox.classList.remove('hidden');
  elements.bookingGate.querySelector('button').disabled = false;
}

function showTemporaryMessage(message) {
  showAlert(message, 'success');
}

function toggleModal(show) {
  elements.usageModal.classList.toggle('hidden', !show);
}
