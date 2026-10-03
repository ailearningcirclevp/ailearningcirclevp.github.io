// AI Learning Circle — slide-out menu for the member pages (phones).
// Adds a hamburger button to the top bar that opens the same kind of side
// panel the public homepage has: website, calendar, library, account.
(function () {
  var css = '' +
    '.mm-btn{display:none;appearance:none;border:1px solid var(--line);background:var(--surface-1);border-radius:10px;width:40px;height:40px;margin-left:auto;cursor:pointer;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:0;}' +
    '.mm-btn span{display:block;width:18px;height:2px;background:var(--ink-900);border-radius:2px;}' +
    '.mm-back{position:fixed;inset:0;background:rgba(8,16,36,.45);opacity:0;pointer-events:none;transition:opacity .2s;z-index:60;}' +
    '.mm-back.open{opacity:1;pointer-events:auto;}' +
    '.mm-drawer{position:fixed;top:0;left:0;bottom:0;width:min(82vw,300px);background:var(--surface-0);border-right:1px solid var(--line);transform:translateX(-100%);transition:transform .22s ease;z-index:61;padding:18px 16px;overflow-y:auto;}' +
    '.mm-drawer.open{transform:translateX(0);}' +
    '.mm-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;}' +
    '.mm-head img{height:30px;border-radius:4px;}' +
    '.mm-close{appearance:none;border:none;background:transparent;font-size:20px;cursor:pointer;color:var(--slate-500);padding:4px;}' +
    '.mm-label{font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--slate-500);margin:14px 0 2px 8px;}' +
    '.mm-link{display:block;width:100%;text-align:left;appearance:none;border:none;background:transparent;font-family:inherit;font-size:15px;font-weight:600;color:var(--ink-900);padding:11px 8px;border-radius:10px;text-decoration:none;cursor:pointer;}' +
    '.mm-link:hover{background:var(--cream-200);}' +
    '.mm-link.active{background:var(--navy-900);color:var(--gold-500);}' +
    '@media (max-width:640px){.mm-btn{display:flex;}}' +
    '@media (min-width:641px){.mm-drawer,.mm-back{display:none;}}';
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  function ready(fn) {
    if (document.readyState !== 'loading') fn(); else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var nav = document.querySelector('.topnav');
    if (!nav) return;
    var page = (location.pathname.split('/').pop() || '').toLowerCase();

    var btn = document.createElement('button');
    btn.className = 'mm-btn';
    btn.setAttribute('aria-label', 'Open menu');
    btn.innerHTML = '<span></span><span></span><span></span>';
    var brand = nav.querySelector('.brand');
    if (brand) brand.insertAdjacentElement('afterend', btn); else nav.prepend(btn);

    var back = document.createElement('div');
    back.className = 'mm-back';
    var drawer = document.createElement('div');
    drawer.className = 'mm-drawer';
    document.body.appendChild(back);
    document.body.appendChild(drawer);

    function link(href, label, file) {
      return '<a class="mm-link' + (file && page === file ? ' active' : '') + '" href="' + href + '">' + label + '</a>';
    }
    function build() {
      var isAdmin = !!document.querySelector('.admin-tab-link');
      drawer.innerHTML =
        '<div class="mm-head"><img src="assets/logo.svg" alt="AI Learning Circle"><button class="mm-close" aria-label="Close menu">✕</button></div>' +
        '<div class="mm-label">Website</div>' +
        link('index.html', 'Home (website)') +
        link('index.html#calendar', 'Session Calendar') +
        link('index.html#membership', 'Membership') +
        '<div class="mm-label">My account</div>' +
        link('dashboard.html', 'My Dashboard', 'dashboard.html') +
        link('library.html', 'Knowledge Library', 'library.html') +
        link('sessions.html', 'Sessions', 'sessions.html') +
        link('profile.html', 'Profile', 'profile.html') +
        (isAdmin ? link('admin.html', 'Admin', 'admin.html') : '') +
        '<button class="mm-link" id="mm-logout">Log out</button>';
      drawer.querySelector('.mm-close').addEventListener('click', close);
      var lo = drawer.querySelector('#mm-logout');
      lo.addEventListener('click', function () { if (typeof signOut === 'function') signOut(); else location.href = 'login.html'; });
    }
    function open() { build(); drawer.classList.add('open'); back.classList.add('open'); }
    function close() { drawer.classList.remove('open'); back.classList.remove('open'); }
    btn.addEventListener('click', open);
    back.addEventListener('click', close);
  });
})();
