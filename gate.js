// Runs in <head>, before anything is drawn. A file of its own (not inline) so the
// Content-Security-Policy in index.html can forbid inline scripts. Inside a block, so
// nothing here becomes a global.
{
  // 1. FindNotes runs only as the installed app: notes live on the device, and a browser tab
  // keeps its own separate storage. A browser tab is sent to the install page; the app is sent
  // back. Loaded on both index.html and welcome.html, so the two pages share one check and can't loop.
  let onWelcome = false;
  try {
    const installed = ['standalone', 'fullscreen', 'minimal-ui'].some((m) => matchMedia(`(display-mode: ${m})`).matches)
      || navigator.standalone === true;
    onWelcome = location.pathname.endsWith('/welcome.html');
    const host = location.hostname;
    const local = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')
      || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
    // On your own computer the app opens in the browser so you can work on it;
    // open /welcome.html directly to see the install page.
    if (installed && onWelcome) location.replace('./');
    else if (!installed && !onWelcome && !local) location.replace('welcome.html');
  } catch { /* matchMedia missing: leave the page alone */ }

  // 2. The app's theme, so light never flashes dark first (the install page has its own look).
  // Light, Dark, or Auto (nothing saved): follow the phone. The Sketch style is always light.
  // Show icons off adds .no-icons.
  if (!onWelcome) {
    try {
      const t = localStorage.getItem('find-notes:theme');
      const sketch = localStorage.getItem('find-notes:style') === 'sketch';
      const light = sketch || t === 'light' || (t !== 'dark' && matchMedia('(prefers-color-scheme: light)').matches);
      if (light) document.documentElement.dataset.theme = 'light';
      if (sketch) document.documentElement.dataset.style = 'sketch';
      if (localStorage.getItem('find-notes:icons') === 'off') document.documentElement.classList.add('no-icons');
      // The status bar (on Android) is the theme's colour from the first frame, not dark,
      // and the iPhone paints anything outside the page in the theme's light or dark, not always dark.
      // index.html loads this after those meta tags, so they are there to change.
      if (light) {
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', sketch ? '#f8f8ff' : '#fbfbfa');
        document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', 'light');
      }
    } catch { /* storage blocked: stay dark, icons on */ }
  }
}
