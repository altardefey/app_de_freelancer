// o token vai pro app e é validado pelo supabase, nunca só aqui
window.onSecurityReady = function () {
  const sitekey = new URLSearchParams(location.search).get('sitekey');
  if (!sitekey || !/^[A-Za-z0-9_-]{1,100}$/.test(sitekey)) return;
  const send = token => window.ReactNativeWebView?.postMessage(token);
  window.turnstile.render('#check', {
    sitekey, callback: send,
    'expired-callback': () => send(''),
    'error-callback': () => send(''),
  });
};
const script = document.createElement('script');
script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onSecurityReady&render=explicit';
document.head.appendChild(script);
