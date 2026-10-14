// "Unlock this resource" flow for the public Knowledge Library.
// Step 1: explain membership. Step 2: small confirmation. Then WhatsApp.
(function () {
  var css = '' +
  '.um-veil{position:fixed;inset:0;background:rgba(10,18,40,.55);display:none;align-items:center;justify-content:center;z-index:9999;padding:16px;}' +
  '.um-veil.open{display:flex;}' +
  '.um-box{background:#fff;color:#0f1e3d;border-radius:20px;max-width:420px;width:100%;padding:24px 22px 20px;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.35);font-family:Inter,system-ui,sans-serif;}' +
  '.um-box .um-ic{font-size:36px;line-height:1;}' +
  '.um-box h3{font-family:Fraunces,Georgia,serif;font-size:22px;margin:8px 0 10px;color:#0f1e3d;}' +
  '.um-box p{font-size:14.5px;line-height:1.6;margin:0 0 10px;color:#3b4560;}' +
  '.um-box .um-btn{display:block;width:100%;border-radius:12px;padding:13px 14px;font:700 15px Inter,system-ui,sans-serif;cursor:pointer;margin-top:10px;border:1px solid #0f1e3d;}' +
  '.um-box .um-go{background:#0b6b3a;border-color:#064d29;color:#fff;}' +
  '.um-box .um-go:hover{background:#085c31;}' +
  '.um-box .um-no{background:#fff;color:#0f1e3d;}' +
  '@media (prefers-color-scheme: dark){.um-box{background:#14264f;color:#fff;}.um-box h3{color:#fff;}.um-box p{color:#d5def5;}.um-box .um-no{background:transparent;color:#fff;border-color:#9cc4ff;}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  var veil = document.createElement('div');
  veil.className = 'um-veil';
  veil.setAttribute('role', 'dialog'); veil.setAttribute('aria-modal', 'true');
  veil.innerHTML = '<div class="um-box" id="um-box"></div>';
  document.body.appendChild(veil);
  var box = veil.querySelector('#um-box');

  function close() { veil.classList.remove('open'); }
  veil.addEventListener('click', function (e) { if (e.target === veil) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

  function step1() {
    box.innerHTML =
      '<div class="um-ic">🔓</div>' +
      '<h3>Unlock this resource</h3>' +
      '<p>This resource is available to AI Learning Circle members.</p>' +
      '<p>You can browse the Knowledge Library freely. Membership gives you access to the practice materials, prompt guides, recordings and reusable resources from each session.</p>' +
      '<p>To get access, continue to WhatsApp for membership and payment details.</p>' +
      '<button class="um-btn um-go" id="um-continue">Continue to WhatsApp</button>' +
      '<button class="um-btn um-no" id="um-later">Maybe later</button>';
    box.querySelector('#um-continue').onclick = step2;
    box.querySelector('#um-later').onclick = close;
  }
  function step2() {
    box.innerHTML =
      '<h3>Continue to WhatsApp?</h3>' +
      '<p>This will open WhatsApp with the AI Learning Circle host, where you can get membership, payment and access details.</p>' +
      '<button class="um-btn um-go" id="um-open">Open WhatsApp</button>' +
      '<button class="um-btn um-no" id="um-cancel">Cancel</button>';
    box.querySelector('#um-open').onclick = function () {
      var w = window.open(LIBRARY_WHATSAPP_URL, '_blank', 'noopener');
      if (!w) window.location.href = LIBRARY_WHATSAPP_URL;
      close();
    };
    box.querySelector('#um-cancel').onclick = close;
  }
  window.openUnlockModal = function () { step1(); veil.classList.add('open'); };
})();
