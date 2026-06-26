import { ROOMS } from './config.js';

let db;
let auth;
let firestoreModule;
let authModule;

let collection, query, where, orderBy, onSnapshot, addDoc, doc, deleteDoc, runTransaction, serverTimestamp, updateDoc, getDocs;
let signInWithEmailAndPassword, onAuthStateChanged, signOut;

let adminBookings = [];
let notifications = [];
let subscriptionBookings = null;
let subscriptionNotifications = null;
let currentEditId = null;

const elements = {
  loadingOverlay: document.getElementById('loadingOverlay'),
  authSection: document.getElementById('authSection'),
  adminEmail: document.getElementById('adminEmail'),
  adminPassword: document.getElementById('adminPassword'),
  adminLogin: document.getElementById('adminLogin'),
  authAlert: document.getElementById('authAlert'),
  dashboard: document.getElementById('dashboard'),
  upcomingCount: document.getElementById('upcomingCount'),
  todayCount: document.getElementById('todayCount'),
  notificationCount: document.getElementById('notificationCount'),
  adminState: document.getElementById('adminState'),
  filterDate: document.getElementById('filterDate'),
  filterRoom: document.getElementById('filterRoom'),
  filterGroup: document.getElementById('filterGroup'),
  clearFilter: document.getElementById('clearFilter'),
  bookingsTable: document.getElementById('bookingsTable'),
  notificationList: document.getElementById('notificationList'),
  adminSignOut: document.getElementById('adminSignOut'),
  editModal: document.getElementById('editModal'),
  closeEdit: document.getElementById('closeEdit'),
  editForm: document.getElementById('editForm'),
  editAlert: document.getElementById('editAlert'),
  editGroupName: document.getElementById('editGroupName'),
  editLeaderName: document.getElementById('editLeaderName'),
  editPhone: document.getElementById('editPhone'),
  editRoomSelect: document.getElementById('editRoomSelect'),
  editDate: document.getElementById('editDate'),
  editStartTime: document.getElementById('editStartTime'),
  editEndTime: document.getElementById('editEndTime'),
  editNotes: document.getElementById('editNotes'),
  cancelEdit: document.getElementById('cancelEdit'),
};

async function init() {
  showLoading();

  try {
    const firebaseSetup = await import('./firebase-config.js').catch(() => null);

    if (!firebaseSetup?.firebaseConfig) {
      showAuthError('ملف firebase-config.js غير موجود أو إعداداته غير صحيحة.');
      return;
    }

    const firebaseConfig = firebaseSetup.firebaseConfig;

    const firebaseAppModule = await import(
      'https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js'
    );

    authModule = await import(
      'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js'
    );

    ({
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} = authModule);

    firestoreModule = await import(
      'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js'
    );

    ({
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  doc,
  deleteDoc,
  runTransaction,
  serverTimestamp,
  updateDoc,
  getDocs
} = firestoreModule);

    const app = firebaseAppModule.initializeApp(firebaseConfig);

    db = firestoreModule.getFirestore(app);
    auth = authModule.getAuth(app);

    authModule.onAuthStateChanged(auth, handleAuthState);

    bindEvents();
    populateRoomFilter();
    populateRoomSelect();

  } catch (error) {
    console.error('Firebase init error:', error);
    showAuthError('صار خطأ بتشغيل Firebase. افتح Console وشوف الخطأ.');
  } finally {
    hideLoading();
  }
}

function bindEvents() {
  elements.adminLogin.addEventListener('click', handleAdminLogin);
  elements.clearFilter.addEventListener('click', clearFilters);
  elements.filterDate.addEventListener('change', renderBookingsTable);
  elements.filterRoom.addEventListener('change', renderBookingsTable);
  elements.filterGroup.addEventListener('input', renderBookingsTable);
  elements.adminSignOut.addEventListener('click', handleSignOut);
  elements.closeEdit.addEventListener('click', closeEditModal);
  elements.cancelEdit.addEventListener('click', closeEditModal);
  elements.editForm.addEventListener('submit', handleEditSubmit);
}

function handleAdminLogin() {
  clearAuthError();

  const email = elements.adminEmail.value.trim();
  const password = elements.adminPassword.value.trim();

  if (!email || !password) {
    showAuthError('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
    return;
  }

  authModule.signInWithEmailAndPassword(auth, email, password)
    .catch((error) => {
      console.error('Admin login error:', error);
      showAuthError('بيانات الدخول غير صحيحة أو لم يتم تفعيل Email/Password في Firebase.');
    });
}

function handleAuthState(user) {
  if (user) {
    elements.authSection.classList.add('hidden');
    elements.dashboard.classList.remove('hidden');
    elements.adminState.textContent = 'متصل';
    subscribeAdminData();
  } else {
    elements.authSection.classList.remove('hidden');
    elements.dashboard.classList.add('hidden');
    elements.adminState.textContent = 'غير متصل';
    unsubscribeAdminData();
  }
}

function subscribeAdminData() {
  const bookingsRef = collection(db, 'bookings');

  subscriptionBookings = onSnapshot(
    bookingsRef,
    (snapshot) => {
      adminBookings = snapshot.docs
        .map(item => ({
          id: item.id,
          ...item.data()
        }))
        .sort((a, b) => {
          const dateCompare = (a.date || '').localeCompare(b.date || '');
          if (dateCompare !== 0) return dateCompare;
          return (a.startTime || '').localeCompare(b.startTime || '');
        });

      console.log('عدد الحجوزات:', adminBookings.length);

      renderStats();
      renderBookingsTable();
    },
    (error) => {
      console.error('خطأ قراءة الحجوزات:', error);
      alert('خطأ Firebase بالحجوزات: ' + error.message);
    }
  );

  const notificationsRef = collection(db, 'notifications');

  subscriptionNotifications = onSnapshot(
    notificationsRef,
    (snapshot) => {
      notifications = snapshot.docs
        .map(item => ({
          id: item.id,
          ...item.data()
        }))
        .filter(item => item.read !== true)
        .sort((a, b) => {
          const dateA = a.createdAt?.toMillis?.() || 0;
          const dateB = b.createdAt?.toMillis?.() || 0;
          return dateB - dateA;
        });

      console.log('عدد الإشعارات غير المقروءة:', notifications.length);

      renderNotifications();
      renderStats();
    },
    (error) => {
      console.error('خطأ تحميل الإشعارات:', error);
      alert('خطأ Firebase بالإشعارات: ' + error.message);
    }
  );
}

function unsubscribeAdminData() {
  if (subscriptionBookings) subscriptionBookings();
  if (subscriptionNotifications) subscriptionNotifications();
}

function populateRoomFilter() {
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = 'كل الغرف';
  elements.filterRoom.appendChild(defaultOption);
  ROOMS.forEach(room => {
    const option = document.createElement('option');
    option.value = room.id;
    option.textContent = room.label;
    elements.filterRoom.appendChild(option);
  });
}

function populateRoomSelect() {
  ROOMS.forEach(room => {
    const option = document.createElement('option');
    option.value = room.id;
    option.textContent = room.label;
    elements.editRoomSelect.appendChild(option);
  });
}

function renderStats() {
  const today = formatDate(new Date());
  const upcoming = adminBookings.length;
  const todayCount = adminBookings.filter(book => book.date === today).length;
  elements.upcomingCount.textContent = upcoming;
  elements.todayCount.textContent = todayCount;
  elements.notificationCount.textContent = notifications.length;
}

function renderBookingsTable() {
  const filtered = adminBookings.filter(book => {
    if (elements.filterDate.value && book.date !== elements.filterDate.value) return false;
    if (elements.filterRoom.value && book.room !== elements.filterRoom.value) return false;
    if (elements.filterGroup.value) {
      const value = elements.filterGroup.value.trim().toLowerCase();
      if (!book.groupName.toLowerCase().includes(value) && !book.leaderName.toLowerCase().includes(value)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    elements.bookingsTable.innerHTML = '<p class="day-note">لا توجد حجوزات مطابقة للفلاتر.</p>';
    return;
  }

  const rows = filtered.map(book => `
    <tr>
      <td>${book.date}</td>
      <td>${book.startTime} - ${book.endTime}</td>
      <td>${getRoomLabel(book.room)}</td>
      <td>${book.groupName}</td>
      <td>${book.leaderName}</td>
      <td>${book.phone}</td>
      <td>${book.notes || 'بدون ملاحظات'}</td>
      <td>
        <button class="btn-secondary edit-btn" data-id="${book.id}">تعديل</button>
        <button class="btn-danger delete-btn" data-id="${book.id}">حذف</button>
      </td>
    </tr>
  `).join('');

  elements.bookingsTable.innerHTML = `
    <table class="bookings-table">
      <thead>
        <tr>
          <th>التاريخ</th>
          <th>الوقت</th>
          <th>الغرفة</th>
          <th>المرحلة</th>
          <th>المسؤول</th>
          <th>الهاتف</th>
          <th>ملاحظات</th>
          <th>الإجراءات</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  elements.bookingsTable.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });
  elements.bookingsTable.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteBooking(btn.dataset.id));
  });
}

function renderNotifications() {
  elements.notificationList.innerHTML = '';
  if (notifications.length === 0) {
    elements.notificationList.innerHTML = '<p class="day-note">لا توجد إشعارات جديدة.</p>';
    return;
  }
  notifications.forEach(note => {
    const item = document.createElement('div');
    item.className = 'notification-item';
    item.innerHTML = `
      <strong>${note.message}</strong>
      <p>تاريخ الإشعار: ${note.createdAt?.toDate ? note.createdAt.toDate().toLocaleString('ar-EG') : ''}</p>
      <button type="button" class="btn-secondary mark-read" data-id="${note.id}">وضع كمقروء</button>
    `;
    const markReadBtn = item.querySelector('.mark-read');
    markReadBtn.addEventListener('click', () => markNotificationRead(note.id));
    elements.notificationList.appendChild(item);
  });
}

function openEditModal(bookingId) {
  const booking = adminBookings.find(book => book.id === bookingId);
  if (!booking) return;
  currentEditId = bookingId;
  elements.editGroupName.value = booking.groupName;
  elements.editLeaderName.value = booking.leaderName;
  elements.editPhone.value = booking.phone;
  elements.editRoomSelect.value = booking.room;
  elements.editDate.value = booking.date;
  elements.editStartTime.value = booking.startTime;
  elements.editEndTime.value = booking.endTime;
  elements.editNotes.value = booking.notes || '';
  elements.editModal.classList.remove('hidden');
}

function showLoading() {
  elements.loadingOverlay?.classList.remove('hidden');
}

function hideLoading() {
  elements.loadingOverlay?.classList.add('hidden');
}

function closeEditModal() {
  elements.editModal.classList.add('hidden');
  currentEditId = null;
  clearEditAlert();
}

async function handleEditSubmit(event) {
  event.preventDefault();
  clearEditAlert();
  if (!currentEditId) return;

  const payload = {
    groupName: elements.editGroupName.value.trim(),
    leaderName: elements.editLeaderName.value.trim(),
    phone: elements.editPhone.value.trim(),
    room: elements.editRoomSelect.value,
    date: elements.editDate.value,
    startTime: elements.editStartTime.value,
    endTime: elements.editEndTime.value,
    notes: elements.editNotes.value.trim(),
  };

  if (!payload.groupName || !payload.leaderName || !payload.phone || !payload.date || !payload.startTime || !payload.endTime) {
    showEditError('جميع الحقول المطلوبة يجب أن تكون ممتلئة.');
    return;
  }
  if (timeToMinutes(payload.endTime) <= timeToMinutes(payload.startTime)) {
    showEditError('يجب أن يكون وقت النهاية بعد وقت البداية.');
    return;
  }

  try {
    await updateBooking(currentEditId, payload);
    closeEditModal();
  } catch (error) {
    showEditError(error.message || 'فشل تحديث الحجز. حاول مرة أخرى.');
  }
}

async function updateBooking(bookingId, payload) {
  await firestoreModule.runTransaction(db, async (tx) => {
    const bookingRef = firestoreModule.doc(db, 'bookings', bookingId);
    const bookingSnapshot = await tx.get(bookingRef);
    if (!bookingSnapshot.exists()) {
      throw new Error('الحجز غير موجود أو تم حذفه.');
    }
    const bookingsQuery = query(firestoreModule.collection(db, 'bookings'), firestoreModule.where('room', '==', payload.room), firestoreModule.where('date', '==', payload.date));
    const snapshot = await getDocs(bookingsQuery);
    snapshot.docs.forEach(docSnap => {
      if (docSnap.id === bookingId) return;
      const existing = docSnap.data();
      if (hasOverlap(payload, existing)) {
        throw new Error('هذا الوقت محجوز بالفعل. اختر وقتًا آخر.');
      }
    });
    tx.update(bookingRef, payload);
  });
}

function hasOverlap(newBooking, existing) {
  const startA = timeToMinutes(newBooking.startTime);
  const endA = timeToMinutes(newBooking.endTime);
  const startB = timeToMinutes(existing.startTime);
  const endB = timeToMinutes(existing.endTime);
  return startA < endB && endA > startB;
}

async function deleteBooking(bookingId) {
  const confirmed = confirm('هل تريد حذف هذا الحجز نهائيًا؟');
  if (!confirmed) return;
  try {
    await firestoreModule.deleteDoc(firestoreModule.doc(db, 'bookings', bookingId));
    showAuthError('تم حذف الحجز بنجاح');
  } catch (error) {
    showAuthError('حدث خطأ أثناء حذف الحجز. حاول مرة أخرى.');
  }
}

async function markNotificationRead(notificationId) {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true
    });

    notifications = notifications.filter(note => note.id !== notificationId);

    renderNotifications();
    renderStats();

    console.log('تم وضع الإشعار كمقروء:', notificationId);
  } catch (error) {
    console.error('خطأ وضع الإشعار كمقروء:', error);
    alert('فشل وضع الإشعار كمقروء: ' + error.message);
  }
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function getRoomLabel(roomId) {
  return ROOMS.find(room => room.id === roomId)?.label || roomId;
}

function clearFilters() {
  if (elements.filterDate) elements.filterDate.value = '';
  if (elements.filterRoom) elements.filterRoom.value = '';
  if (elements.filterGroup) elements.filterGroup.value = '';

  renderBookingsTable();

  console.log('تم مسح الفلاتر');
}

function timeToMinutes(value) {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

function showAuthError(message) {
  elements.authAlert.className = 'alert-box error';
  elements.authAlert.textContent = message;
  elements.authAlert.classList.remove('hidden');
}

function clearAuthError() {
  elements.authAlert.classList.add('hidden');
  elements.authAlert.textContent = '';
}

function showEditError(message) {
  elements.editAlert.className = 'alert-box error';
  elements.editAlert.textContent = message;
  elements.editAlert.classList.remove('hidden');
}

function clearEditAlert() {
  elements.editAlert.classList.add('hidden');
  elements.editAlert.textContent = '';
}

async function handleSignOut() {
  try {
    await authModule.signOut(auth);
  } catch (error) {
    console.error('Sign out failed:', error);
    showAuthError('تعذر تسجيل الخروج. حاول مرة ثانية.');
  }
}

init();