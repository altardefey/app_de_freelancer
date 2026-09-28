import { useEffect, useRef, useState } from "react";
import type { BotCheckProps } from "./BotCheck";
type Turnstile = {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  remove: (id: string) => void;
};
declare global { interface Window { turnstile?: Turnstile } }
let scriptReady: Promise<void> | undefined;
function loadScript() {
  if (window.turnstile) return Promise.resolve();
  return scriptReady ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { scriptReady = undefined; script.remove(); reject(new Error("captcha")); };
    document.head.appendChild(script);
  });
}
export function BotCheck({ onToken, resetKey }: BotCheckProps) {
  const target = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const sitekey = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY;
  useEffect(() => {
    let active = true;
    let id: string | undefined;
    onToken(undefined);
    if (!sitekey) return;
    loadScript().then(() => {
      if (!active || !target.current || !window.turnstile) return;
      id = window.turnstile.render(target.current, {
        sitekey, callback: (token: string) => { setFailed(false); onToken(token); },
        "expired-callback": () => onToken(undefined),
        "error-callback": () => { setFailed(true); onToken(undefined); },
      });
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; if (id) window.turnstile?.remove(id); };
  }, [onToken, resetKey, sitekey]);
  return <div><div ref={target} />{failed ? <p role="alert">Não foi possível verificar. Atualize a página e tente novamente.</p> : null}</div>;
}
