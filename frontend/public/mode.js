try {
  var mode = localStorage.getItem('mode')
  if (mode === 'light' || mode === 'dark') document.documentElement.dataset.mode = mode
} catch {}
