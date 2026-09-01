async function saymdCheckout(plan) {
  const res = await fetch('/api/create-checkout-saymd', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  });
  const data = await res.json();
  if (data.url) window.location.href = data.url;
  else alert(data.error || 'Checkout unavailable');
}

document.querySelectorAll('[data-plan]').forEach((el) => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    saymdCheckout(el.getAttribute('data-plan'));
  });
});

document.querySelectorAll('[data-copy]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const target = document.getElementById(btn.dataset.copy);
    if (!target) return;
    const text = target.innerText;
    try {
      await navigator.clipboard.writeText(text);
      const original = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => { btn.textContent = original; }, 1200);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(target);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  });
});
