(function(){
  if (document.getElementById('site-legal-footer')) return;
  var f = document.createElement('div');
  f.id = 'site-legal-footer';
  f.style.cssText = 'text-align:center;font-size:12.5px;color:#64748b;padding:22px 16px 30px;line-height:1.9;';
  f.innerHTML = '<a href="terms.html" style="color:inherit;">Terms &amp; Conditions</a> · ' +
    '<a href="privacy.html" style="color:inherit;">Privacy Policy</a> · ' +
    '<a href="mailto:ailearningcirclevp@gmail.com" style="color:inherit;">Contact</a><br>' +
    '© ' + new Date().getFullYear() + ' AI Learning Circle. Educational content only; not professional advice.';
  (document.querySelector('.wrap') || document.body).appendChild(f);
})();
