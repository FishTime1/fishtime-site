const API_BASE = ["localhost", "127.0.0.1"].includes(location.hostname) ? "http://127.0.0.1:8000" : "https://fishtime-api.onrender.com";
const PLAN_LABELS = { trial_2h: "2 Saat", day_1: "1 Gün", day_7: "7 Gün", day_15: "15 Gün", day_30: "30 Gün" };
const PLAN_SECONDS = { trial_2h: 7200, day_1: 86400, day_7: 604800, day_15: 1296000, day_30: 2592000 };
const DEFAULT_SITE_CONFIG = {
  setup_video_raw_url: "https://www.youtube.com/watch?v=jCRnwHDHFmA&t=225s",
  setup_video_watch_url: "https://www.youtube.com/watch?v=jCRnwHDHFmA&t=225s",
  setup_video_embed_url: "https://www.youtube.com/embed/jCRnwHDHFmA?start=225",
};
const TAB_META = {
  home: ["Ana Sayfa", "Sistemin genel özetini ve son hareketleri burada görürsün."],
  users: ["Kullanıcılar", "Üyelikleri yönet, süre ekle, cihaz sıfırla ve hesap sil."],
  messages: ["Mesajlar", "Kullanıcı konuşmalarını aç, cevap ver ve temizle."],
  codes: ["Kod Üretici", "Yeni kod üret, listele ve gerektiğinde sil."],
  video: ["Kurulum Videosu", "Anasayfadaki kurulum videosunu YouTube linki ile yönet."]
};

const state = {
  token: sessionStorage.getItem("ft_admin_token") || "",
  adminKey: sessionStorage.getItem("ft_admin_key") || "",
  username: sessionStorage.getItem("ft_admin_username") || "",
  stats: null,
  users: [],
  messages: [],
  codes: [],
  siteConfig: { ...DEFAULT_SITE_CONFIG },
  selectedUserId: null,
  selectedConversationId: null,
  selectedMessageId: null,
  loading: false,
};

const el = {
  loginScreen: document.getElementById("loginScreen"),
  appShell: document.getElementById("appShell"),
  loginForm: document.getElementById("loginForm"),
  usernameInput: document.getElementById("usernameInput"),
  passwordInput: document.getElementById("passwordInput"),
  loginButton: document.getElementById("loginButton"),
  clearLoginButton: document.getElementById("clearLoginButton"),
  loginStatus: document.getElementById("loginStatus"),
  refreshAllButton: document.getElementById("refreshAllButton"),
  logoutButton: document.getElementById("logoutButton"),
  userRefreshButton: document.getElementById("userRefreshButton"),
  messageRefreshButton: document.getElementById("messageRefreshButton"),
  codeRefreshButton: document.getElementById("codeRefreshButton"),
  createCodeButton: document.getElementById("createCodeButton"),
  planSelect: document.getElementById("planSelect"),
  codeCreateResult: document.getElementById("codeCreateResult"),
  codeSearchInput: document.getElementById("codeSearchInput"),
  userSearchInput: document.getElementById("userSearchInput"),
  messageSearchInput: document.getElementById("messageSearchInput"),
  sessionChip: document.getElementById("sessionChip"),
  globalStatus: document.getElementById("globalStatus"),
  apiStatusText: document.getElementById("apiStatusText"),
  sessionStatusText: document.getElementById("sessionStatusText"),
  lastRefreshText: document.getElementById("lastRefreshText"),
  pageTitle: document.getElementById("pageTitle"),
  pageSubtitle: document.getElementById("pageSubtitle"),
  metricUsers: document.getElementById("metricUsers"),
  metricUnread: document.getElementById("metricUnread"),
  metricUsedCodes: document.getElementById("metricUsedCodes"),
  statTotalUsers: document.getElementById("statTotalUsers"),
  statActiveUsers: document.getElementById("statActiveUsers"),
  statExpiredUsers: document.getElementById("statExpiredUsers"),
  statTotalCodes: document.getElementById("statTotalCodes"),
  recentUsersList: document.getElementById("recentUsersList"),
  expiringUsersList: document.getElementById("expiringUsersList"),
  usersList: document.getElementById("usersList"),
  userDetail: document.getElementById("userDetail"),
  userCountBadge: document.getElementById("userCountBadge"),
  conversationList: document.getElementById("conversationList"),
  messageDetail: document.getElementById("messageDetail"),
  messageUnreadBadge: document.getElementById("messageUnreadBadge"),
  codeSummaryList: document.getElementById("codeSummaryList"),
  codesTableBody: document.getElementById("codesTableBody"),
  codeCountBadge: document.getElementById("codeCountBadge"),
  setupVideoUrlInput: document.getElementById("setupVideoUrlInput"),
  saveVideoConfigButton: document.getElementById("saveVideoConfigButton"),
  reloadVideoConfigButton: document.getElementById("reloadVideoConfigButton"),
  videoConfigStatus: document.getElementById("videoConfigStatus"),
  videoConfigDetail: document.getElementById("videoConfigDetail"),
  navButtons: [...document.querySelectorAll(".nav-btn")],
  tabs: [...document.querySelectorAll(".tab")],
};

const html = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const usernameFromEmail = (email) => String(email || "").split("@")[0] || "Kullanıcı";
const fmt = (value) => {
  if (!value) return "Bilinmiyor";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Bilinmiyor" : new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short" }).format(date);
};
const remaining = (seconds) => {
  const total = Number(seconds || 0);
  if (total <= 0) return "Süresi bitmiş";
  const d = Math.floor(total / 86400), h = Math.floor((total % 86400) / 3600), m = Math.floor((total % 3600) / 60);
  return [d ? `${d}g` : "", h ? `${h}s` : "", (m || (!d && !h)) ? `${m}dk` : ""].filter(Boolean).join(" ");
};
const codePlan = (seconds) => {
  const n = Number(seconds || 0);
  for (const [key, val] of Object.entries(PLAN_SECONDS)) if (val === n) return PLAN_LABELS[key];
  return n >= 86400 ? `${Math.round(n / 86400)} Gün` : `${Math.round(n / 3600)} Saat`;
};
function mapError(detail) {
  return {
    invalid_admin_credentials: "Kullanıcı adı veya şifre hatalı.",
    admin_unauthorized: "Oturum geçersiz. Lütfen yeniden giriş yap.",
    invalid_duration: "Eklemek istediğin süre 0'dan büyük olmalı.",
    password_too_short: "Yeni şifre en az 6 karakter olmalı.",
    user_not_found: "Kullanıcı bulunamadı.",
    message_required: "Mesaj boş bırakılamaz.",
    message_not_found: "Mesaj bulunamadı.",
    code_not_found: "Kod bulunamadı.",
    invalid_plan: "Geçersiz plan seçildi.",
    invalid_setup_video_url: "Geçerli bir YouTube linki gir."
  }[String(detail || "")] || String(detail || "Bilinmeyen hata");
}
function setLoginStatus(message, isError = false) { el.loginStatus.textContent = message || ""; el.loginStatus.classList.toggle("error", !!isError); }
function setGlobalStatus(message, isError = false) { el.globalStatus.textContent = message || "Hazır"; el.globalStatus.style.color = isError ? "#fecdd3" : "#dbeafe"; }
function clearSession() { state.token = ""; state.adminKey = ""; state.username = ""; sessionStorage.removeItem("ft_admin_token"); sessionStorage.removeItem("ft_admin_key"); sessionStorage.removeItem("ft_admin_username"); }
function showLogin() { el.loginScreen.classList.remove("hidden"); el.appShell.classList.add("hidden"); el.sessionStatusText.textContent = "Giriş bekleniyor"; }
function showApp() { el.loginScreen.classList.add("hidden"); el.appShell.classList.remove("hidden"); el.sessionChip.textContent = `Yönetici: ${state.username || "fishtimeadmincan"}`; el.sessionStatusText.textContent = "Yetkili oturum açık"; }
function setActiveTab(tab) { el.navButtons.forEach((b) => b.classList.toggle("active", b.dataset.tab === tab)); el.tabs.forEach((p) => p.classList.toggle("active", p.dataset.page === tab)); const [title, subtitle] = TAB_META[tab] || TAB_META.home; el.pageTitle.textContent = title; el.pageSubtitle.textContent = subtitle; if (tab === "video") renderVideoSettings(); }
async function api(path, options = {}) {
  const headers = new Headers(options.headers || {}); headers.set("Accept", "application/json"); if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json"); if (state.token) headers.set("X-Admin-Token", state.token); if (state.adminKey) headers.set("X-Admin-Key", state.adminKey);
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const text = await res.text(); let data = null; if (text) { try { data = JSON.parse(text); } catch { data = { raw: text }; } }
  if (!res.ok) { if (res.status === 401) clearSession(); throw new Error(mapError(data?.detail || data?.message || res.statusText)); }
  return data;
}
function empty(text) { return `<div class="empty">${html(text)}</div>`; }
function infoStatus(text) { return `<span class="loader"></span> ${html(text)}`; }
function getFilteredUsers() { const q = el.userSearchInput.value.trim().toLowerCase(); return q ? state.users.filter((u) => String(u.email || "").toLowerCase().includes(q)) : state.users; }
function getFilteredMessages() { const q = el.messageSearchInput.value.trim().toLowerCase(); return q ? state.messages.filter((m) => `${m.email || ""} ${m.last_message || ""}`.toLowerCase().includes(q)) : state.messages; }
function getFilteredCodes() { const q = el.codeSearchInput.value.trim().toLowerCase(); return q ? state.codes.filter((c) => String(c.code || "").toLowerCase().includes(q)) : state.codes; }
function parseYouTubeTime(value) {
  const raw = String(value || "").trim().replace(/^t=/, "");
  if (!raw) return 0;
  if (/^\d+$/.test(raw)) return Number(raw);
  let total = 0;
  const matches = [...raw.matchAll(/(\d+)(h|m|s)/gi)];
  for (const match of matches) {
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    if (unit === "h") total += amount * 3600;
    if (unit === "m") total += amount * 60;
    if (unit === "s") total += amount;
  }
  return total;
}
function buildYouTubeConfig(rawUrl) {
  const raw = String(rawUrl || "").trim();
  if (!raw) throw new Error("Geçerli bir YouTube linki gir.");
  let url;
  try { url = new URL(raw); } catch { throw new Error("Geçerli bir YouTube linki gir."); }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  let videoId = "";
  let start = 0;
  if (url.searchParams.get("start")) start = parseYouTubeTime(url.searchParams.get("start"));
  if (url.searchParams.get("t")) start = parseYouTubeTime(url.searchParams.get("t"));
  if (host === "youtu.be") {
    videoId = url.pathname.replace(/^\/+/, "").split("/")[0];
  } else if (host.endsWith("youtube.com")) {
    if (url.pathname === "/watch") videoId = url.searchParams.get("v") || "";
    else if (url.pathname.startsWith("/embed/")) videoId = url.pathname.split("/")[2] || "";
    else if (url.pathname.startsWith("/shorts/")) videoId = url.pathname.split("/")[2] || "";
  }
  if (!/^[A-Za-z0-9_-]{6,}$/.test(videoId)) throw new Error("Geçerli bir YouTube linki gir.");
  let watch = `https://www.youtube.com/watch?v=${videoId}`;
  let embed = `https://www.youtube.com/embed/${videoId}`;
  if (start > 0) {
    watch += `&t=${start}s`;
    embed += `?start=${start}`;
  }
  return {
    setup_video_raw_url: raw,
    setup_video_watch_url: watch,
    setup_video_embed_url: embed,
  };
}
function setVideoConfigStatus(message, isError = false) {
  if (!el.videoConfigStatus) return;
  el.videoConfigStatus.textContent = message || "";
  el.videoConfigStatus.classList.toggle("error", !!isError);
}
function renderVideoSettings() {
  if (!el.videoConfigDetail || !el.setupVideoUrlInput) return;
  const config = { ...DEFAULT_SITE_CONFIG, ...(state.siteConfig || {}) };
  state.siteConfig = config;
  if (document.activeElement !== el.setupVideoUrlInput) {
    el.setupVideoUrlInput.value = config.setup_video_raw_url || config.setup_video_watch_url || "";
  }
  el.videoConfigDetail.innerHTML = `
    <div class="section-head"><h3>Canlı Önizleme</h3></div>
    <p class="brand-sub">Kaydettiğin video anasayfada kurulum videosu alanında gösterilir.</p>
    <iframe class="admin-video-frame" src="${html(config.setup_video_embed_url)}" title="Kurulum Videosu Önizleme" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
    <div class="link-card"><span>YouTube Linki</span><a href="${html(config.setup_video_watch_url)}" target="_blank" rel="noreferrer">${html(config.setup_video_watch_url)}</a></div>
    <div class="link-card"><span>Embed Linki</span><div class="mono-link">${html(config.setup_video_embed_url)}</div></div>
  `;
}

function renderHome() {
  const stats = state.stats || {};
  el.metricUsers.textContent = stats.total_users ?? state.users.length;
  el.metricUnread.textContent = stats.unread_support_messages ?? 0;
  el.metricUsedCodes.textContent = stats.used_codes ?? 0;
  el.statTotalUsers.textContent = stats.total_users ?? state.users.length;
  el.statActiveUsers.textContent = stats.active_users ?? 0;
  el.statExpiredUsers.textContent = stats.expired_users ?? 0;
  el.statTotalCodes.textContent = stats.total_codes ?? state.codes.length;

  const recent = [...state.users].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 6);
  const expiring = [...state.users].filter((u) => Number(u.remaining_seconds || 0) > 0).sort((a, b) => Number(a.remaining_seconds || 0) - Number(b.remaining_seconds || 0)).slice(0, 6);
  el.recentUsersList.innerHTML = recent.length ? recent.map((u) => `<div class="stack-item"><strong>${html(usernameFromEmail(u.email))}</strong><span>${html(u.email)}<br>Kayıt: ${html(fmt(u.created_at))}<br>Kalan: ${html(remaining(u.remaining_seconds))}</span></div>`).join("") : empty("Henüz kullanıcı bulunmuyor.");
  el.expiringUsersList.innerHTML = expiring.length ? expiring.map((u) => `<div class="stack-item"><strong>${html(u.email)}</strong><span>Kalan: ${html(remaining(u.remaining_seconds))}<br>Cihaz: ${html(String(u.device_count || 0))}/${html(String(u.device_limit || 0))}<br>Son cihaz: ${html(fmt(u.last_device_seen_at))}</span></div>`).join("") : empty("Yakında bitecek aktif kullanıcı görünmüyor.");
}

function renderUsers() {
  const users = getFilteredUsers(); el.userCountBadge.textContent = String(users.length);
  el.usersList.innerHTML = users.length ? users.map((u) => {
    const active = Number(u.remaining_seconds || 0) > 0;
    return `<button class="row-card ${u.id === state.selectedUserId ? "active" : ""}" data-user-id="${u.id}" type="button"><div class="row-top"><div class="row-title">${html(u.email)}</div><span class="badge ${active ? "green" : "red"}">${active ? "Aktif" : "Pasif"}</span></div><div class="row-sub">Kullanıcı: ${html(usernameFromEmail(u.email))}</div><div class="row-meta">Kalan: ${html(remaining(u.remaining_seconds))}</div><div class="row-meta">Cihaz: ${html(String(u.device_count || 0))}/${html(String(u.device_limit || 0))}</div></button>`;
  }).join("") : empty("Aramana uygun kullanıcı bulunamadı.");
  el.usersList.querySelectorAll("[data-user-id]").forEach((btn) => btn.addEventListener("click", async () => { state.selectedUserId = Number(btn.dataset.userId); renderUsers(); await renderSelectedUser(); }));
}

async function renderSelectedUser() {
  const user = state.users.find((u) => u.id === state.selectedUserId);
  if (!user) { el.userDetail.innerHTML = empty("Soldan bir kullanıcı seçtiğinde detaylar burada açılacak."); return; }
  const active = Number(user.remaining_seconds || 0) > 0;
  const devices = Array.isArray(user.devices) ? user.devices : [];
  el.userDetail.innerHTML = `
    <div class="detail-head"><div><h2>${html(user.email)}</h2><p>Kullanıcı: ${html(usernameFromEmail(user.email))}<br>Kayıt: ${html(fmt(user.created_at))}<br>Son cihaz etkinliği: ${html(fmt(user.last_device_seen_at))}</p></div><span class="badge ${active ? "green" : "red"}">${active ? "Aktif Hesap" : "Süresi Bitmiş"}</span></div>
    <div class="meta-grid">
      <div class="meta-card"><span>Kalan Süre</span><strong>${html(remaining(user.remaining_seconds))}</strong></div>
      <div class="meta-card"><span>Cihaz Sayısı</span><strong>${html(String(user.device_count || 0))}/${html(String(user.device_limit || 0))}</strong></div>
      <div class="meta-card"><span>Bitiş Zamanı</span><strong>${html(fmt(user.expires_at))}</strong></div>
      <div class="meta-card"><span>Sunucu Zamanı</span><strong>${html(fmt(user.server_time))}</strong></div>
    </div>
    <div class="section-box"><h4>Süre Ekle</h4><p>Gün, saat veya dakika ekleyebilirsin.</p><div class="form-grid"><div><label>Gün</label><input id="addDaysInput" type="number" min="0" value="0"></div><div><label>Saat</label><input id="addHoursInput" type="number" min="0" value="0"></div><div><label>Dakika</label><input id="addMinutesInput" type="number" min="0" value="0"></div></div><div class="action-row"><button class="btn success" id="addTimeButton" type="button">Süre Ekle</button><span class="status" id="userActionStatus"></span></div></div>
    <div class="section-box"><h4>Şifre Sıfırla</h4><p>Kullanıcıya yeni şifre atayabilirsin.</p><div class="action-row"><input id="resetPasswordInput" type="text" placeholder="Yeni şifre"><button class="btn primary" id="resetPasswordButton" type="button">Şifreyi Değiştir</button></div></div>
    <div class="section-box"><h4>Cihazlar</h4><p>Kayıtlı cihazlar ve hızlı işlemler.</p><div class="device-grid">${devices.length ? devices.map((d) => `<div class="device-pill"><strong>${html(d.device_id)}</strong><span>İlk: ${html(fmt(d.first_seen))}</span><span>Son: ${html(fmt(d.last_seen))}</span></div>`).join("") : empty("Bu kullanıcıda kayıtlı cihaz yok.")}</div><div class="action-row"><button class="btn ghost" id="resetDevicesButton" type="button">Tüm Cihazları Sıfırla</button><button class="btn danger" id="deleteUserButton" type="button">Kullanıcıyı Sil</button></div></div>`;
  const statusEl = document.getElementById("userActionStatus"); const setStatus = (m, e = false) => { statusEl.textContent = m || ""; statusEl.classList.toggle("error", !!e); };
  document.getElementById("addTimeButton").addEventListener("click", async () => {
    const payload = { email: user.email, days: Number(document.getElementById("addDaysInput").value || 0), hours: Number(document.getElementById("addHoursInput").value || 0), minutes: Number(document.getElementById("addMinutesInput").value || 0) };
    setStatus("Süre ekleniyor...");
    try { await api("/v1/admin/users/add-time", { method: "POST", body: JSON.stringify(payload) }); setStatus("Süre eklendi."); await refreshAllData(); } catch (err) { setStatus(err.message, true); }
  });
  document.getElementById("resetPasswordButton").addEventListener("click", async () => {
    const new_password = String(document.getElementById("resetPasswordInput").value || "").trim(); if (!new_password) { setStatus("Yeni şifre gerekli.", true); return; }
    setStatus("Şifre güncelleniyor...");
    try { await api("/v1/admin/users/reset-password", { method: "POST", body: JSON.stringify({ email: user.email, new_password }) }); setStatus("Şifre güncellendi."); document.getElementById("resetPasswordInput").value = ""; } catch (err) { setStatus(err.message, true); }
  });
  document.getElementById("resetDevicesButton").addEventListener("click", async () => {
    if (!confirm(`${user.email} için tüm cihazları sıfırlamak istiyor musun?`)) return;
    setStatus("Cihazlar sıfırlanıyor...");
    try { await api("/v1/admin/users/reset-devices", { method: "POST", body: JSON.stringify({ email: user.email }) }); setStatus("Cihazlar sıfırlandı."); await refreshAllData(); } catch (err) { setStatus(err.message, true); }
  });
  document.getElementById("deleteUserButton").addEventListener("click", async () => {
    if (!confirm(`${user.email} hesabını tamamen silmek istiyor musun?`)) return;
    setStatus("Kullanıcı siliniyor...");
    try { await api("/v1/admin/users/delete", { method: "POST", body: JSON.stringify({ email: user.email }) }); state.selectedUserId = null; setStatus("Kullanıcı silindi."); await refreshAllData(true); } catch (err) { setStatus(err.message, true); }
  });
}

function renderConversations() {
  const rows = getFilteredMessages(); const unread = state.stats?.unread_support_messages ?? state.messages.reduce((s, m) => s + Number(m.unread_count || 0), 0); el.messageUnreadBadge.textContent = String(unread);
  el.conversationList.innerHTML = rows.length ? rows.map((m) => `<button class="row-card ${m.user_id === state.selectedConversationId ? "active" : ""}" data-user-id="${m.user_id}" type="button"><div class="row-top"><div class="row-title">${html(m.email)}</div>${Number(m.unread_count || 0) > 0 ? `<span class="badge">${html(String(m.unread_count))}</span>` : '<span class="badge green">Okundu</span>'}</div><div class="row-sub">${html(m.last_sender_role === "admin" ? "Son mesaj senden" : "Son mesaj kullanıcıdan")}</div><div class="row-meta">${html(m.last_message || "")}</div><div class="row-meta">${html(fmt(m.last_message_at))}</div></button>`).join("") : empty("Henüz mesaj bulunmuyor.");
  el.conversationList.querySelectorAll("[data-user-id]").forEach((btn) => btn.addEventListener("click", async () => { state.selectedConversationId = Number(btn.dataset.userId); state.selectedMessageId = null; renderConversations(); await renderSelectedConversation(); }));
}

async function renderSelectedConversation() {
  if (!state.selectedConversationId) { el.messageDetail.innerHTML = empty("Soldan bir konuşma seçtiğinde mesajlar burada açılacak."); return; }
  el.messageDetail.innerHTML = empty("Mesajlar yükleniyor...");
  try {
    const thread = await api(`/v1/admin/messages/${state.selectedConversationId}`); const user = thread.user || {}; const messages = Array.isArray(thread.messages) ? thread.messages : [];
    el.messageDetail.innerHTML = `
      <div class="detail-head"><div><h2>${html(user.email || "Mesajlar")}</h2><p>Kullanıcı: ${html(usernameFromEmail(user.email || ""))}<br>Toplam mesaj: ${html(String(messages.length))}</p></div><span class="badge">${html(String(messages.length))}</span></div>
      <div class="thread-box" id="threadBox">${messages.length ? messages.map((m) => `<div class="bubble-wrap ${m.sender_role === "admin" ? "admin" : "user"}"><div class="bubble-meta"><span>${html(m.sender_role === "admin" ? "Sen" : "Kullanıcı")}</span><span>${html(fmt(m.created_at))}</span>${m.id === state.selectedMessageId ? "<span>Seçili</span>" : ""}</div><div class="bubble ${m.id === state.selectedMessageId ? "selected" : ""}" data-message-id="${m.id}">${html(m.body)}</div></div>`).join("") : empty("Bu konuşmada mesaj bulunmuyor.")}</div>
      <div class="reply-box"><textarea id="replyTextarea" placeholder="Kullanıcıya cevap yaz..."></textarea><div class="reply-actions"><button class="btn primary" id="sendReplyButton" type="button">Cevap Gönder</button><button class="btn danger" id="deleteMessageButton" type="button">Seçili Mesajı Sil</button><button class="btn ghost" id="reloadThreadButton" type="button">Konuşmayı Yenile</button><button class="btn danger" id="deleteThreadButton" type="button">Tüm Konuşmayı Sil</button></div><div class="status" id="messageActionStatus"></div></div>`;
    const threadBox = document.getElementById("threadBox"); threadBox.scrollTop = threadBox.scrollHeight;
    document.querySelectorAll("[data-message-id]").forEach((node) => node.addEventListener("click", () => { state.selectedMessageId = Number(node.dataset.messageId); renderSelectedConversation(); }));
    const statusEl = document.getElementById("messageActionStatus"); const setStatus = (m, e = false) => { statusEl.textContent = m || ""; statusEl.classList.toggle("error", !!e); };
    document.getElementById("sendReplyButton").addEventListener("click", async () => {
      const message = String(document.getElementById("replyTextarea").value || "").trim(); if (!message) { setStatus("Önce bir cevap yaz.", true); return; }
      setStatus("Mesaj gönderiliyor...");
      try { await api(`/v1/admin/messages/${state.selectedConversationId}`, { method: "POST", body: JSON.stringify({ message }) }); state.selectedMessageId = null; setStatus("Mesaj gönderildi."); await refreshAllData(); await renderSelectedConversation(); } catch (err) { setStatus(err.message, true); }
    });
    document.getElementById("deleteMessageButton").addEventListener("click", async () => {
      if (!state.selectedMessageId) { setStatus("Önce silmek istediğin mesajı seç.", true); return; }
      if (!confirm("Seçili mesajı silmek istiyor musun?")) return;
      setStatus("Mesaj siliniyor...");
      try { await api(`/v1/admin/messages/item/${state.selectedMessageId}`, { method: "DELETE" }); state.selectedMessageId = null; setStatus("Mesaj silindi."); await refreshAllData(); await renderSelectedConversation(); } catch (err) { setStatus(err.message, true); }
    });
    document.getElementById("deleteThreadButton").addEventListener("click", async () => {
      if (!confirm(`${user.email} ile tüm konuşmayı silmek istiyor musun?`)) return;
      setStatus("Konuşma siliniyor...");
      try { await api(`/v1/admin/messages/thread/${state.selectedConversationId}`, { method: "DELETE" }); state.selectedConversationId = null; state.selectedMessageId = null; setStatus("Konuşma silindi."); await refreshAllData(true); } catch (err) { setStatus(err.message, true); }
    });
    document.getElementById("reloadThreadButton").addEventListener("click", async () => { await refreshAllData(); await renderSelectedConversation(); });
  } catch (err) { el.messageDetail.innerHTML = empty(err.message); }
}

function renderCodes() {
  const codes = getFilteredCodes(); const total = state.codes.length; const used = state.codes.filter((c) => c.is_used).length; const waiting = Math.max(total - used, 0);
  el.codeCountBadge.textContent = String(codes.length);
  el.codeSummaryList.innerHTML = `<div class="stack-item"><strong>${html(String(total))}</strong><span>Toplam kod</span></div><div class="stack-item"><strong>${html(String(used))}</strong><span>Kullanılan kod</span></div><div class="stack-item"><strong>${html(String(waiting))}</strong><span>Kullanılmamış kod</span></div>`;
  el.codesTableBody.innerHTML = codes.length ? codes.map((c) => `<tr><td><strong>${html(c.code)}</strong></td><td>${html(codePlan(c.duration_seconds))}</td><td>${c.is_used ? '<span class="badge green">Kullanıldı</span>' : '<span class="badge">Bekliyor</span>'}</td><td>${html(c.used_by_user_id ? String(c.used_by_user_id) : "-")}</td><td>${html(fmt(c.created_at))}</td><td><button class="btn danger small-btn" data-code-id="${c.id}" type="button">Sil</button></td></tr>`).join("") : '<tr><td colspan="6">Kod bulunamadı.</td></tr>';
  el.codesTableBody.querySelectorAll("[data-code-id]").forEach((btn) => btn.addEventListener("click", async () => { if (!confirm("Bu kodu silmek istiyor musun?")) return; setGlobalStatus("Kod siliniyor..."); try { await api(`/v1/admin/codes/${Number(btn.dataset.codeId)}`, { method: "DELETE" }); setGlobalStatus("Kod silindi."); await refreshAllData(); } catch (err) { setGlobalStatus(err.message, true); } }));
}

async function refreshAllData(forceSelect = false) {
  if ((!state.token && !state.adminKey) || state.loading) return;
  state.loading = true; setGlobalStatus("Veriler yenileniyor..."); el.apiStatusText.innerHTML = infoStatus("API ile konuşuluyor");
  try {
    const [stats, users, messages, codes, siteConfig] = await Promise.all([
      api("/v1/admin/stats"),
      api("/v1/admin/users"),
      api("/v1/admin/messages"),
      api("/v1/admin/codes"),
      api("/v1/admin/site-config").catch(() => state.siteConfig || DEFAULT_SITE_CONFIG),
    ]);
    state.stats = stats || {};
    state.users = Array.isArray(users) ? users : [];
    state.messages = Array.isArray(messages) ? messages : [];
    state.codes = Array.isArray(codes) ? codes : [];
    state.siteConfig = { ...DEFAULT_SITE_CONFIG, ...(siteConfig || {}) };
    if (forceSelect || !state.users.some((u) => u.id === state.selectedUserId)) state.selectedUserId = state.users[0]?.id ?? null;
    if (forceSelect || !state.messages.some((m) => m.user_id === state.selectedConversationId)) { state.selectedConversationId = state.messages[0]?.user_id ?? null; state.selectedMessageId = null; }
    renderHome(); renderUsers(); await renderSelectedUser(); renderConversations(); await renderSelectedConversation(); renderCodes(); renderVideoSettings();
    el.apiStatusText.textContent = "Bağlı"; el.lastRefreshText.textContent = fmt(new Date().toISOString()); setGlobalStatus("Veriler güncel");
  } catch (err) {
    el.apiStatusText.textContent = "Bağlantı sorunu"; setGlobalStatus(err.message, true); if (!state.token && !state.adminKey) showLogin();
  } finally { state.loading = false; }
}

async function createCode() {
  const plan = el.planSelect.value; el.createCodeButton.disabled = true; setGlobalStatus("Kod oluşturuluyor...");
  try {
    const result = await api("/v1/admin/codes", { method: "POST", body: JSON.stringify({ plan }) });
    el.codeCreateResult.innerHTML = `<div class="result-banner">Yeni kod üretildi:<br><strong>${html(result.code)}</strong><br>Plan: ${html(PLAN_LABELS[plan] || result.plan || "-")}<br>Oluşturulma: ${html(fmt(result.created_at))}</div>`;
    setGlobalStatus("Kod hazır"); await refreshAllData();
  } catch (err) {
    el.codeCreateResult.innerHTML = `<div class="result-banner error">${html(err.message)}</div>`; setGlobalStatus(err.message, true);
  } finally { el.createCodeButton.disabled = false; }
}

async function handleLogin(event) {
  event.preventDefault(); const username = el.usernameInput.value.trim(); const password = el.passwordInput.value;
  if (!username || !password) { setLoginStatus("Kullanıcı adı ve şifre gerekli.", true); return; }
  if (username !== "fishtimeadmincan") { setLoginStatus("Kullanıcı adı hatalı.", true); return; }
  el.loginButton.disabled = true; setLoginStatus("Giriş yapılıyor...");
  try {
    let loggedIn = false;
    try {
      const data = await api("/v1/admin/web-login", { method: "POST", body: JSON.stringify({ username, password }) });
      state.token = data.token;
      state.adminKey = "";
      state.username = data.username || username;
      sessionStorage.setItem("ft_admin_token", state.token);
      sessionStorage.removeItem("ft_admin_key");
      sessionStorage.setItem("ft_admin_username", state.username);
      loggedIn = true;
    } catch (tokenErr) {
      state.token = "";
      state.adminKey = password;
      await api("/v1/admin/stats");
      state.username = username;
      sessionStorage.removeItem("ft_admin_token");
      sessionStorage.setItem("ft_admin_key", state.adminKey);
      sessionStorage.setItem("ft_admin_username", state.username);
      loggedIn = true;
    }
    if (loggedIn) {
      setLoginStatus(""); showApp(); await refreshAllData(true);
    }
  } catch (err) { clearSession(); setLoginStatus(err.message, true); }
  finally { el.loginButton.disabled = false; }
}
function bind() {
  el.loginForm.addEventListener("submit", handleLogin);
  el.clearLoginButton.addEventListener("click", () => { el.usernameInput.value = ""; el.passwordInput.value = ""; setLoginStatus(""); });
  el.navButtons.forEach((btn) => btn.addEventListener("click", () => setActiveTab(btn.dataset.tab)));
  el.refreshAllButton.addEventListener("click", () => refreshAllData());
  el.userRefreshButton.addEventListener("click", () => refreshAllData());
  el.messageRefreshButton.addEventListener("click", () => refreshAllData());
  el.codeRefreshButton.addEventListener("click", () => refreshAllData());
  el.createCodeButton.addEventListener("click", createCode);
  if (el.saveVideoConfigButton) {
    el.saveVideoConfigButton.addEventListener("click", async () => {
      try {
        const payload = buildYouTubeConfig(el.setupVideoUrlInput.value);
        el.saveVideoConfigButton.disabled = true;
        setVideoConfigStatus("Video ayarı kaydediliyor...");
        const data = await api("/v1/admin/site-config", {
          method: "POST",
          body: JSON.stringify({
            raw_url: payload.setup_video_raw_url,
            watch_url: payload.setup_video_watch_url,
            embed_url: payload.setup_video_embed_url,
          }),
        });
        state.siteConfig = { ...DEFAULT_SITE_CONFIG, ...(data || payload) };
        renderVideoSettings();
        setVideoConfigStatus("Kurulum videosu güncellendi.");
      } catch (err) {
        setVideoConfigStatus(err.message, true);
      } finally {
        el.saveVideoConfigButton.disabled = false;
      }
    });
  }
  if (el.reloadVideoConfigButton) {
    el.reloadVideoConfigButton.addEventListener("click", async () => {
      try {
        el.reloadVideoConfigButton.disabled = true;
        setVideoConfigStatus("Video ayarı yenileniyor...");
        const data = await api("/v1/admin/site-config");
        state.siteConfig = { ...DEFAULT_SITE_CONFIG, ...(data || {}) };
        renderVideoSettings();
        setVideoConfigStatus("Güncel video ayarı yüklendi.");
      } catch (err) {
        setVideoConfigStatus(err.message, true);
      } finally {
        el.reloadVideoConfigButton.disabled = false;
      }
    });
  }
  el.logoutButton.addEventListener("click", () => { clearSession(); state.stats = null; state.users = []; state.messages = []; state.codes = []; state.siteConfig = { ...DEFAULT_SITE_CONFIG }; state.selectedUserId = null; state.selectedConversationId = null; state.selectedMessageId = null; el.passwordInput.value = ""; setVideoConfigStatus(""); renderVideoSettings(); showLogin(); setLoginStatus(""); });
  el.userSearchInput.addEventListener("input", renderUsers);
  el.messageSearchInput.addEventListener("input", renderConversations);
  el.codeSearchInput.addEventListener("input", renderCodes);
}

(async function bootstrap() {
  renderVideoSettings();
  bind();
  el.usernameInput.value = state.username || "fishtimeadmincan";
  if (!state.token && !state.adminKey) { showLogin(); return; }
  showApp();
  try { await refreshAllData(true); } catch { showLogin(); }
})();
