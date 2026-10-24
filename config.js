// Put your Render backend URL here (wss:// for https). No trailing slash, no /ws.
// Example: window.GAME_SERVER = 'wss://fighter-relay.onrender.com';
window.GAME_SERVER = 'wss://YOUR-APP-NAME.onrender.com';

// Wake a sleeping free-tier Render server as soon as the page opens.
try {
  if (/^wss?:\/\//.test(window.GAME_SERVER) && !/YOUR-APP-NAME/.test(window.GAME_SERVER)) {
    fetch(window.GAME_SERVER.replace(/^ws/, 'http') + '/healthz', { mode: 'no-cors' }).catch(function () {});
  }
} catch (e) {}
