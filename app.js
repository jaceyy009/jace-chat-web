// app.js

// Firebase is already initialized via config.js
const auth = firebase.auth();
const db = firebase.firestore();

// ----- GLOBALS -----
let currentFriendId = null;

// ----- SIGN UP -----
const signupBtn = document.getElementById('signup-btn');
signupBtn.addEventListener('click', () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  if (!email || !password) return alert("Enter email and password");

  auth.createUserWithEmailAndPassword(email, password)
    .then((userCredential) => {
      const user = userCredential.user;
      alert('Account created!');

      // Create user document in Firestore
      db.collection('users').doc(user.uid).set({
        email: user.email,
        friends: []
      });
      document.getElementById('email').value = '';
      document.getElementById('password').value = '';
    })
    .catch((error) => alert(error.message));
});

// ----- LOGIN -----
const loginBtn = document.getElementById('login-btn');
loginBtn.addEventListener('click', () => {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  if (!email || !password) return alert("Enter email and password");

  auth.signInWithEmailAndPassword(email, password)
    .then(() => {
      document.getElementById('auth-container').style.display = 'none';
      document.getElementById('chat-container').style.display = 'block';
      loadFriends();
      document.getElementById('email').value = '';
      document.getElementById('password').value = '';
    })
    .catch((error) => alert(error.message));
});

// ----- ADD FRIEND -----
const addFriendBtn = document.getElementById('add-friend-btn');
addFriendBtn.addEventListener('click', async () => {
  const friendEmail = document.getElementById('friend-email').value;
  const currentUser = auth.currentUser;

  if (!friendEmail) return alert("Enter your friend's email");

  // Search for friend by email
  const friendSnapshot = await db.collection('users').where('email', '==', friendEmail).get();
  if (!friendSnapshot.empty) {
    const friendId = friendSnapshot.docs[0].id;

    if (friendId === currentUser.uid) return alert("You cannot add yourself");

    // Add friend to current user's friends list
    await db.collection('users').doc(currentUser.uid).update({
      friends: firebase.firestore.FieldValue.arrayUnion(friendId)
    });

    alert('Friend added!');
    document.getElementById('friend-email').value = '';
    loadFriends();
  } else {
    alert('User not found');
  }
});

// ----- LOAD FRIENDS -----
async function loadFriends() {
  const currentUser = auth.currentUser;
  const userDoc = await db.collection('users').doc(currentUser.uid).get();
  const friends = userDoc.data().friends || [];

  const friendsList = document.getElementById('friends-list');
  friendsList.innerHTML = '<b>Friends:</b><br>';

  friends.forEach(async (friendId) => {
    const friendDoc = await db.collection('users').doc(friendId).get();
    const friendEmail = friendDoc.data().email;

    // Make each friend clickable
    const friendSpan = document.createElement('span');
    friendSpan.classList.add('friend');
    friendSpan.dataset.id = friendId;
    friendSpan.textContent = friendEmail;
    friendSpan.style.cursor = 'pointer';
    friendSpan.style.color = 'blue';
    friendSpan.addEventListener('click', () => {
      setupChat(friendId);
    });

    friendsList.appendChild(friendSpan);
    friendsList.appendChild(document.createElement('br'));
  });
}

// ----- SETUP CHAT WITH FRIEND -----
function setupChat(friendId) {
  currentFriendId = friendId;
  const currentUser = auth.currentUser;
  const chatId = [currentUser.uid, friendId].sort().join('_');
  const chatBox = document.getElementById('chat-box');

  // Clear previous messages
  chatBox.innerHTML = '';

  // Listen for new messages
  db.collection('chats').doc(chatId).collection('messages')
    .orderBy('timestamp')
    .onSnapshot(snapshot => {
      chatBox.innerHTML = '';
      snapshot.forEach(doc => {
        const msg = doc.data();
        const sender = msg.sender === currentUser.uid ? 'You' : 'Friend';
        chatBox.innerHTML += `<b>${sender}:</b> ${msg.text}<br>`;
        chatBox.scrollTop = chatBox.scrollHeight;
      });
    });
}

// ----- SEND MESSAGE -----
const sendBtn = document.getElementById('send-btn');
sendBtn.addEventListener('click', async () => {
  const message = document.getElementById('message-input').value;
  const currentUser = auth.currentUser;

  if (!currentFriendId) return alert("Select a friend first");
  if (!message) return;

  const chatId = [currentUser.uid, currentFriendId].sort().join('_');

  await db.collection('chats').doc(chatId).collection('messages').add({
    sender: currentUser.uid,
    text: message,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    participants: [currentUser.uid, currentFriendId]
  });

  document.getElementById('message-input').value = '';
});

// ----- AUTO LOAD FRIENDS WHEN LOGGED IN -----
auth.onAuthStateChanged(user => {
  if (user) {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('chat-container').style.display = 'block';
    loadFriends();
  }
});
