(() => {
  const PREMIUM_KEY = 'cism_premium_v1';
  const $ = (id) => document.getElementById(id);

  function isValidCode(code) {
    const c = String(code || '').trim().toUpperCase();
    if (c.length < 10) return false;
    return c.startsWith('SECPLUS-') || c.startsWith('CISM-');
  }

  function setPremium(on) {
    if (on) localStorage.setItem(PREMIUM_KEY, '1');
    else localStorage.removeItem(PREMIUM_KEY);
    updateUI();
  }

  function isPremium() {
    return localStorage.getItem(PREMIUM_KEY) === '1';
  }

  function updateUI() {
    const badge = $('premiumBadge');
    if (!badge) return;
    badge.style.display = isPremium() ? 'inline-flex' : 'none';
  }

  function init() {
    updateUI();

    const buyPro = $('buyPro');
    const buyLife = $('buyLife');
    if (buyPro) buyPro.addEventListener('click', (e) => {
      e.preventDefault();
      alert('Add your Pro payment link here (Stripe/Gumroad). After purchase, provide an unlock code.');
    });
    if (buyLife) buyLife.addEventListener('click', (e) => {
      e.preventDefault();
      alert('Add your Lifetime payment link here (Stripe/Gumroad). After purchase, provide an unlock code.');
    });

    const btnApply = $('btnApply');
    const btnDisable = $('btnDisable');
    const codeInput = $('codeInput');

    if (btnApply) btnApply.addEventListener('click', () => {
      const code = codeInput ? codeInput.value : '';
      if (!isValidCode(code)) {
        alert('Invalid code. (Demo rule: must start with SECPLUS- or CISM-)');
        return;
      }
      setPremium(true);
      alert('Premium enabled ✅');
    });

    if (btnDisable) btnDisable.addEventListener('click', () => {
      if (!confirm('Disable premium on this device?')) return;
      setPremium(false);
      alert('Premium disabled.');
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
