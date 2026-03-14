// src/App.tsx
import { useEffect, useState, useRef, useCallback } from 'react';

declare global { interface Window { Telegram: any; } }

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

// ── API клиент ────────────────────────────────────────────────────
function useApi(initData: string) {
  const request = useCallback(async (method: string, path: string, body?: object) => {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `tma ${initData}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Request failed');
    return data;
  }, [initData]);

  return {
    get:  (path: string)               => request('GET',  path),
    post: (path: string, body: object) => request('POST', path, body),
  };
}

// ── Анимации ──────────────────────────────────────────────────────
function spawnParticles(x: number, y: number, container: HTMLDivElement) {
  const colors = ['#38bdf8','#818cf8','#fb7185','#34d399','#fbbf24'];
  for (let i = 0; i < 12; i++) {
    const el = document.createElement('div');
    const angle = (i / 12) * Math.PI * 2;
    const dist = 40 + Math.random() * 60;
    const color = colors[Math.floor(Math.random() * colors.length)];
    el.style.cssText = `position:fixed;pointer-events:none;z-index:9999;
      width:${5+Math.random()*6}px;height:${5+Math.random()*6}px;
      border-radius:50%;background:${color};left:${x}px;top:${y}px;
      transform:translate(-50%,-50%);
      transition:all 0.6s cubic-bezier(0.25,0.46,0.45,0.94);opacity:1;`;
    container.appendChild(el);
    requestAnimationFrame(() => {
      el.style.transform = `translate(calc(-50% + ${Math.cos(angle)*dist}px),calc(-50% + ${Math.sin(angle)*dist}px)) scale(0)`;
      el.style.opacity = '0';
    });
    setTimeout(() => el.remove(), 700);
  }
}

function useAnimatedCount(target: number, duration = 600) {
  const [display, setDisplay] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    const start = prev.current, diff = target - start;
    if (!diff) return;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      setDisplay(Math.round(start + diff * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    prev.current = target;
  }, [target]);
  return display;
}

function useRipple() {
  const ref = useRef<HTMLButtonElement>(null);
  const trigger = useCallback((e: React.MouseEvent) => {
    const btn = ref.current; if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement('span');
    const size = Math.max(rect.width, rect.height) * 2;
    ripple.style.cssText = `position:absolute;border-radius:50%;background:rgba(255,255,255,0.3);
      width:${size}px;height:${size}px;pointer-events:none;
      left:${e.clientX-rect.left-size/2}px;top:${e.clientY-rect.top-size/2}px;
      transform:scale(0);animation:ripple 0.55s ease-out forwards;`;
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
  }, []);
  return { ref, trigger };
}

// ── Экран авторизации ─────────────────────────────────────────────
function AuthScreen({ onAuth }: { onAuth: (initData: string, user: any) => void }) {
  const [status, setStatus] = useState<'idle'|'loading'|'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [mounted, setMounted] = useState(false);
  const btnRipple = useRipple();

  useEffect(() => {
    setTimeout(() => setMounted(true), 80);

    // Если уже открыто в Telegram — авторизуем автоматически
    const tg = window.Telegram?.WebApp;
    if (tg?.initData) {
      tg.ready();
      tg.expand();
      handleAuth(tg.initData, tg.initDataUnsafe?.user);
    }
  }, []);

  const handleAuth = async (initData: string, tgUser?: any) => {
    setStatus('loading');
    setErrorMsg('');
    try {
      const res = await fetch(`${API}/api/user/me`, {
        headers: { 'Authorization': `tma ${initData}` },
      });
      if (!res.ok) throw new Error('Ошибка авторизации');
      const user = await res.json();
      onAuth(initData, user);
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err.message);
    }
  };

  const handleDevAuth = (e: React.MouseEvent) => {
    btnRipple.trigger(e);
    handleAuth('dev_bypass', { id: 1, first_name: 'Dev', username: 'devuser' });
  };

  const isDev = import.meta.env.DEV;

  return (
    <div className={`auth-wrap ${mounted ? 'mounted' : ''}`}>
      {/* Фоновые круги */}
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />

      <div className="auth-card">
        {/* Логотип */}
        <div className="auth-logo">
          <div className="auth-logo-ring" />
          <span className="auth-logo-icon">🏠</span>
        </div>

        <h1 className="auth-title">ОСИ Костанай</h1>
        <p className="auth-subtitle">Сервис для жильцов вашего дома</p>

        <div className="auth-features">
          <div className="auth-feature">
            <span>🎁</span>
            <span>Бонусы за активность</span>
          </div>
          <div className="auth-feature">
            <span>💳</span>
            <span>Оплата взносов ОСИ</span>
          </div>
          <div className="auth-feature">
            <span>👥</span>
            <span>Реферальная программа</span>
          </div>
        </div>

        {status === 'loading' ? (
          <div className="auth-loading">
            <div className="auth-spinner" />
            <span>Авторизация...</span>
          </div>
        ) : (
          <>
            {/* Основная кнопка — работает только внутри Telegram */}
            <div className="auth-tg-btn">
              <div className="auth-tg-icon">
                <svg viewBox="0 0 24 24" fill="white" width="22" height="22">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.04 9.61c-.152.67-.548.836-1.112.52l-3.08-2.27-1.485 1.43c-.165.165-.303.303-.62.303l.22-3.123 5.677-5.127c.247-.22-.054-.342-.383-.122L7.19 14.41l-3.02-.944c-.657-.205-.67-.657.137-.973l11.79-4.544c.548-.2 1.028.122.865.3z"/>
                </svg>
              </div>
              <span>Войти через Telegram</span>
              <span className="auth-tg-note">Откройте в приложении Telegram</span>
            </div>

            {/* Dev кнопка — только в режиме разработки */}
            {isDev && (
              <button
                ref={btnRipple.ref}
                className="auth-dev-btn"
                onClick={handleDevAuth}
              >
                🛠 Войти как Dev (localhost)
              </button>
            )}

            {status === 'error' && (
              <div className="auth-error">⚠️ {errorMsg}</div>
            )}
          </>
        )}

        <p className="auth-note">
          Авторизация происходит через ваш аккаунт Telegram.<br/>
          Мы не храним пароли и личные данные.
        </p>
      </div>
    </div>
  );
}

// ── Главный экран ─────────────────────────────────────────────────
const TASK_COLORS: Record<string, string> = {
  watch_ad: '#38bdf8', invite_neighbor: '#818cf8',
  rate_app: '#fbbf24', fill_profile: '#34d399',
};
const TASK_ICONS: Record<string, string> = {
  watch_ad: '📺', invite_neighbor: '👥',
  rate_app: '⭐', fill_profile: '📝',
};

function MainScreen({ user: initialUser, initData }: { user: any; initData: string }) {
  const api = useApi(initData);
  const [user, setUser]       = useState(initialUser);
  const [tasks, setTasks]     = useState<any[]>([]);
  const [flash, setFlash]     = useState('');
  const [mounted, setMounted] = useState(false);
  const [adCooldown, setAdCooldown] = useState(0);
  const particleRef = useRef<HTMLDivElement>(null);
  const adRipple = useRipple();
  const displayBonus = useAnimatedCount(user?.bonus ?? 0);

  const showFlash = (txt: string) => { setFlash(txt); setTimeout(() => setFlash(''), 1200); };

  useEffect(() => {
    api.get('/api/user/tasks').then((d: any) => setTasks(d.tasks)).catch(console.error);
    setTimeout(() => setMounted(true), 50);
  }, []);

  useEffect(() => {
    if (adCooldown <= 0) return;
    const t = setTimeout(() => setAdCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearTimeout(t);
  }, [adCooldown]);

  const handleAd = async (e: React.MouseEvent) => {
    if (adCooldown > 0) return;
    adRipple.trigger(e);
    if (particleRef.current) spawnParticles(e.clientX, e.clientY, particleRef.current);
    try {
      const res = await api.post('/api/bonus/ad', {});
      setUser((u: any) => ({ ...u, bonus: res.new_balance, level: res.level }));
      showFlash(`+${res.reward} тг`);
      setAdCooldown(30);
    } catch (err: any) { showFlash(err.message); }
  };

  const handleTask = async (task: any, e: React.MouseEvent) => {
    if (task.done) return;
    if (particleRef.current) spawnParticles(e.clientX, e.clientY, particleRef.current);
    try {
      const res = await api.post('/api/bonus/task', { task_id: task.id });
      setUser((u: any) => ({ ...u, bonus: res.new_balance, level: res.level }));
      setTasks((ts: any[]) => ts.map(t => t.id === task.id ? { ...t, done: true } : t));
      showFlash(`+${task.reward} тг`);
    } catch (err: any) { showFlash(err.message); }
  };

  const progress = Math.min((user?.bonus ?? 0) % 100, 100);

  return (
    <>
      <div ref={particleRef} />
      {flash && <div className="flash-el">{flash}</div>}

      <div className={`app ${mounted ? 'm' : ''}`}>
        {/* Шапка */}
        <div className="card c1 header">
          <div className="avatar">
            {user?.first_name?.[0]?.toUpperCase() ?? '🏠'}
          </div>
          <div>
            <div className="uname">
              {user?.first_name}{user?.last_name ? ' ' + user.last_name : ''}
            </div>
            <div className="usub">
              {user?.username ? `@${user.username}` : `ID: ${user?.id}`}
            </div>
          </div>
          <div className="streak">🔥 {user?.streak ?? 0}</div>
        </div>

        {/* Баланс */}
        <div className="card c2 bal">
          <div className="bal-lbl">Бонусный баланс</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span className="bal-amt">{displayBonus}</span>
            <span className="bal-unit">тг</span>
          </div>
          <div className="lv-row">
            <span className="lv-tag">Уровень</span>
            <span className="lv-num">Lv {user?.level ?? 1}</span>
          </div>
          <div className="pbar-wrap">
            <div className="pbar" style={{ width: `${progress}%` }} />
          </div>
          <div className="pbar-sub">
            <span>{(user?.bonus ?? 0) % 100} / 100 до след. уровня</span>
            <span>на взносы ОСИ</span>
          </div>
        </div>

        {/* Реклама */}
        <button
          className="card c3 btn-main"
          ref={adRipple.ref}
          onClick={handleAd}
          disabled={adCooldown > 0}
        >
          <div>📺 Смотреть рекламу</div>
          <div className="btn-sub">
            {adCooldown > 0 ? `Следующий просмотр через ${adCooldown} сек.` : '+5 тг за просмотр'}
          </div>
        </button>

        {/* Задания */}
        <div className="sec">Задания дня</div>
        <div className="card c4 tasks">
          {tasks.map((task: any) => (
            <div
              key={task.id}
              className={`task ${task.done ? 'tdone' : ''}`}
              onClick={e => handleTask(task, e)}
            >
              <span className="t-icon">{TASK_ICONS[task.id] ?? '🎯'}</span>
              <div className="t-lbl">{task.label}</div>
              <div className="t-rwd" style={{ color: TASK_COLORS[task.id] ?? '#38bdf8' }}>
                +{task.reward} тг
              </div>
            </div>
          ))}
        </div>

        {/* Статистика */}
        <div className="sec">Статистика</div>
        <div className="card c5 stats">
          <div className="stat">
            <div className="sv" style={{ color: '#38bdf8' }}>{displayBonus}</div>
            <div className="sl">Всего тг</div>
          </div>
          <div className="stat">
            <div className="sv" style={{ color: '#fbbf24' }}>{user?.streak ?? 0}</div>
            <div className="sl">Действий</div>
          </div>
          <div className="stat">
            <div className="sv" style={{ color: '#818cf8' }}>Lv {user?.level ?? 1}</div>
            <div className="sl">Уровень</div>
          </div>
        </div>

        <div className="foot">Ваш сервис для дома · Костанай 🏙️</div>
      </div>
    </>
  );
}

// ── Корневой компонент ────────────────────────────────────────────
export default function App() {
  const [authState, setAuthState] = useState<{
    initData: string;
    user: any;
  } | null>(null);

  const handleAuth = (initData: string, user: any) => {
    setAuthState({ initData, user });
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#0a0e1a;font-family:'DM Sans',sans-serif;-webkit-tap-highlight-color:transparent;overflow-x:hidden;}

        @keyframes ripple{to{transform:scale(1);opacity:0}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
        @keyframes floatUp{0%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-120%) scale(1.6)}}
        @keyframes glow{0%,100%{box-shadow:0 0 24px rgba(56,189,248,0.25)}50%{box-shadow:0 0 44px rgba(56,189,248,0.55)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes orbFloat{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(20px,-20px) scale(1.05)}}
        @keyframes authCardIn{from{opacity:0;transform:translateY(40px) scale(0.96)}to{opacity:1;transform:translateY(0) scale(1)}}
        @keyframes logoSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:0.5;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}

        /* ── AUTH ── */
        .auth-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;
          padding:20px;position:relative;overflow:hidden;background:#0a0e1a;}
        .auth-orb{position:absolute;border-radius:50%;filter:blur(80px);pointer-events:none;}
        .auth-orb-1{width:300px;height:300px;background:rgba(56,189,248,0.12);top:-80px;right:-80px;
          animation:orbFloat 7s ease-in-out infinite;}
        .auth-orb-2{width:250px;height:250px;background:rgba(129,140,248,0.1);bottom:-60px;left:-60px;
          animation:orbFloat 9s ease-in-out infinite reverse;}
        .auth-orb-3{width:180px;height:180px;background:rgba(251,191,36,0.07);top:50%;left:50%;
          transform:translate(-50%,-50%);animation:pulse 4s ease-in-out infinite;}

        .auth-card{position:relative;z-index:1;width:100%;max-width:360px;
          background:rgba(17,24,39,0.9);border:1px solid rgba(255,255,255,0.08);
          border-radius:28px;padding:36px 28px 28px;
          backdrop-filter:blur(20px);
          opacity:0;transition:opacity 0.1s;}
        .auth-wrap.mounted .auth-card{animation:authCardIn 0.6s cubic-bezier(0.34,1.2,0.64,1) forwards;}

        .auth-logo{position:relative;width:80px;height:80px;margin:0 auto 20px;
          display:flex;align-items:center;justify-content:center;}
        .auth-logo-ring{position:absolute;inset:0;border-radius:50%;
          border:2px solid transparent;
          background:linear-gradient(135deg,#38bdf8,#818cf8) border-box;
          -webkit-mask:linear-gradient(#fff 0 0) padding-box,linear-gradient(#fff 0 0);
          -webkit-mask-composite:destination-out;mask-composite:exclude;
          animation:logoSpin 8s linear infinite;}
        .auth-logo-icon{font-size:36px;line-height:1;}

        .auth-title{font-family:'Syne',sans-serif;font-size:26px;font-weight:800;
          text-align:center;color:#f1f5f9;margin-bottom:6px;}
        .auth-subtitle{font-size:14px;color:#475569;text-align:center;margin-bottom:24px;}

        .auth-features{display:flex;flex-direction:column;gap:8px;margin-bottom:28px;}
        .auth-feature{display:flex;align-items:center;gap:12px;padding:10px 14px;
          background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.06);
          border-radius:12px;font-size:14px;color:#94a3b8;}
        .auth-feature span:first-child{font-size:18px;flex-shrink:0;}

        .auth-tg-btn{display:flex;flex-direction:column;align-items:center;gap:4px;
          padding:16px;border-radius:16px;
          background:linear-gradient(135deg,#0088cc,#0066aa);
          border:none;width:100%;margin-bottom:10px;cursor:default;}
        .auth-tg-icon{width:36px;height:36px;background:rgba(255,255,255,0.15);
          border-radius:50%;display:flex;align-items:center;justify-content:center;margin-bottom:6px;}
        .auth-tg-btn span:nth-child(2){font-family:'Syne',sans-serif;font-size:16px;
          font-weight:700;color:#fff;}
        .auth-tg-note{font-size:11px;color:rgba(255,255,255,0.55);}

        .auth-dev-btn{width:100%;padding:13px;border:1px dashed rgba(56,189,248,0.3);
          border-radius:14px;background:rgba(56,189,248,0.05);
          color:#38bdf8;font-size:14px;font-family:'DM Sans',sans-serif;
          cursor:pointer;margin-bottom:10px;position:relative;overflow:hidden;
          transition:background 0.2s,border-color 0.2s;}
        .auth-dev-btn:hover{background:rgba(56,189,248,0.1);border-color:rgba(56,189,248,0.5);}
        .auth-dev-btn:active{transform:scale(0.98);}

        .auth-loading{display:flex;flex-direction:column;align-items:center;gap:12px;
          padding:20px 0;color:#94a3b8;font-size:14px;}
        .auth-spinner{width:32px;height:32px;border:3px solid rgba(56,189,248,0.2);
          border-top-color:#38bdf8;border-radius:50%;animation:spin 0.8s linear infinite;}

        .auth-error{background:rgba(204,68,0,0.1);border:1px solid rgba(204,68,0,0.3);
          border-radius:10px;padding:10px 14px;font-size:13px;color:#f97316;
          margin-bottom:10px;text-align:center;}

        .auth-note{font-size:11px;color:#1e3a4a;text-align:center;
          margin-top:16px;line-height:1.5;padding-top:16px;
          border-top:1px solid rgba(255,255,255,0.05);}

        /* ── MAIN APP ── */
        .app{min-height:100vh;background:#0a0e1a;padding:18px 14px 36px;
          max-width:400px;margin:0 auto;color:#f1f5f9;}
        .card{opacity:0;}.app.m .card{animation:fadeUp 0.45s ease both;}
        .app.m .c1{animation-delay:0s}.app.m .c2{animation-delay:.07s}
        .app.m .c3{animation-delay:.14s}.app.m .c4{animation-delay:.21s}.app.m .c5{animation-delay:.28s}
        .header{display:flex;align-items:center;gap:12px;padding:14px 16px;border-radius:20px;
          background:#111827;border:1px solid rgba(255,255,255,.07);margin-bottom:12px;}
        .avatar{width:44px;height:44px;border-radius:50%;flex-shrink:0;font-size:20px;
          background:linear-gradient(135deg,#38bdf8,#818cf8);
          display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;
          font-family:'Syne',sans-serif;}
        .uname{font-family:'Syne',sans-serif;font-size:16px;font-weight:700;}
        .usub{font-size:12px;color:#475569;margin-top:1px;}
        .streak{margin-left:auto;background:rgba(251,191,36,.12);border:1px solid rgba(251,191,36,.25);
          border-radius:12px;padding:5px 12px;font-size:13px;font-weight:600;color:#fbbf24;white-space:nowrap;}
        .bal{border-radius:22px;padding:22px 20px 16px;margin-bottom:12px;
          background:linear-gradient(135deg,#0f3460,#16213e 60%,#0a0e1a);
          border:1px solid rgba(56,189,248,.2);position:relative;overflow:hidden;animation:glow 3s ease infinite;}
        .bal::before{content:'';position:absolute;top:-40px;right:-40px;width:150px;height:150px;
          border-radius:50%;background:radial-gradient(circle,rgba(56,189,248,.15),transparent 70%);}
        .bal-lbl{font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:4px;}
        .bal-amt{font-family:'Syne',sans-serif;font-size:52px;font-weight:800;line-height:1;
          background:linear-gradient(90deg,#38bdf8,#818cf8,#38bdf8);background-size:200% auto;
          -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
          animation:shimmer 3s linear infinite;}
        .bal-unit{font-size:17px;font-weight:600;color:#94a3b8;margin-left:4px;-webkit-text-fill-color:#94a3b8;}
        .lv-row{display:flex;align-items:center;justify-content:space-between;margin-top:14px;}
        .lv-tag{font-size:11px;color:#94a3b8;}
        .lv-num{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:#38bdf8;
          background:rgba(56,189,248,.1);border:1px solid rgba(56,189,248,.2);border-radius:8px;padding:2px 10px;}
        .pbar-wrap{height:6px;background:rgba(255,255,255,.07);border-radius:99px;margin-top:7px;overflow:hidden;}
        .pbar{height:100%;border-radius:99px;background:linear-gradient(90deg,#38bdf8,#818cf8);
          transition:width .8s cubic-bezier(.34,1.56,.64,1);}
        .pbar-sub{display:flex;justify-content:space-between;margin-top:4px;}
        .pbar-sub span{font-size:10px;color:#334155;}
        .btn-main{width:100%;padding:17px;border:none;border-radius:18px;
          background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;
          font-family:'Syne',sans-serif;font-size:17px;font-weight:700;cursor:pointer;
          position:relative;overflow:hidden;margin-bottom:12px;
          transition:transform .15s,box-shadow .15s,opacity .15s;
          box-shadow:0 8px 28px rgba(14,165,233,.35);}
        .btn-main:active{transform:scale(0.97);}
        .btn-main:hover{box-shadow:0 12px 38px rgba(14,165,233,.5);}
        .btn-main:disabled{opacity:.5;cursor:not-allowed;transform:none;}
        .btn-sub{font-size:12px;opacity:.7;font-family:'DM Sans',sans-serif;font-weight:400;}
        .sec{font-family:'Syne',sans-serif;font-size:11px;font-weight:700;text-transform:uppercase;
          letter-spacing:2px;color:#334155;margin:18px 0 9px;}
        .tasks{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:12px;}
        .task{border-radius:16px;padding:15px 13px;background:#111827;
          border:1px solid rgba(255,255,255,.06);cursor:pointer;position:relative;overflow:hidden;
          transition:transform .18s,border-color .18s,box-shadow .18s;}
        .task:active{transform:scale(0.94);}
        .task:hover:not(.tdone){border-color:rgba(255,255,255,.13);box-shadow:0 4px 18px rgba(0,0,0,.4);}
        .task.tdone{opacity:.4;cursor:default;}
        .task.tdone::after{content:'✓';position:absolute;top:10px;right:11px;font-size:15px;color:#34d399;}
        .t-icon{font-size:24px;margin-bottom:9px;display:block;transition:transform .2s;}
        .task:hover:not(.tdone) .t-icon{transform:scale(1.15) rotate(-6deg);}
        .t-lbl{font-size:12px;font-weight:500;color:#cbd5e1;line-height:1.3;margin-bottom:5px;}
        .t-rwd{font-family:'Syne',sans-serif;font-size:14px;font-weight:700;}
        .stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:9px;margin-bottom:10px;}
        .stat{border-radius:14px;padding:13px 10px;text-align:center;background:#111827;
          border:1px solid rgba(255,255,255,.06);}
        .sv{font-family:'Syne',sans-serif;font-size:20px;font-weight:800;}
        .sl{font-size:10px;color:#475569;margin-top:2px;}
        .flash-el{position:fixed;top:50%;left:50%;pointer-events:none;z-index:9998;
          font-family:'Syne',sans-serif;font-size:38px;font-weight:800;color:#38bdf8;
          animation:floatUp 1.2s ease forwards;}
        .foot{text-align:center;font-size:11px;color:#1e293b;margin-top:6px;}
      `}</style>

      {authState
        ? <MainScreen user={authState.user} initData={authState.initData} />
        : <AuthScreen onAuth={handleAuth} />
      }
    </>
  );
}