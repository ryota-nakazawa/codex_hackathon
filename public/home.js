import { apiFetch, escapeHtml } from "/common.js";

const elements = {
  brandMark: document.getElementById("clinicBrandMark"),
  brandName: document.getElementById("clinicBrandName"),
  brandTag: document.getElementById("clinicBrandTag"),
  heroTitle: document.getElementById("heroTitle"),
  heroLead: document.getElementById("heroLead"),
  heroBadges: document.getElementById("heroBadges"),
  clinicMeta: document.getElementById("clinicMeta"),
  accessSummary: document.getElementById("accessSummary"),
  symptomGrid: document.getElementById("symptomGrid"),
  landingHighlights: document.getElementById("landingHighlights"),
  serviceGrid: document.getElementById("serviceGrid"),
  galleryGrid: document.getElementById("galleryGrid"),
  faqGrid: document.getElementById("faqGrid")
};

const ICONS = {
  tooth: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M8 4.5c1.1-1 2.4-1.5 4-1.5s2.9.5 4 1.5c1 .9 1.5 2.1 1.5 3.4 0 1.4-.4 2.6-1 3.8-.7 1.3-1 2.7-1 4.3 0 1.5-.3 2.7-.9 3.7-.7 1.1-1.6 1.7-2.6 1.7-.9 0-1.5-.4-2-1.1-.4-.6-.7-1.4-.8-2.3-.1-1-.4-1.8-.9-2.4-.5-.6-1-.9-1.4-.9-.5 0-.9.3-1.4.9-.5.6-.8 1.4-.9 2.4-.1.9-.4 1.7-.8 2.3-.5.7-1.1 1.1-2 1.1-1 0-1.9-.6-2.6-1.7-.6-1-.9-2.2-.9-3.7 0-1.6-.3-3-.9-4.3-.6-1.2-1-2.4-1-3.8 0-1.3.5-2.5 1.5-3.4Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
    </svg>
  `,
  shield: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3 19 6v5.2c0 4.3-2.9 8.1-7 9.8-4.1-1.7-7-5.5-7-9.8V6Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
      <path d="M8.6 12.1 11 14.5l4.5-4.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `,
  smile: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.7" />
      <path d="M8.5 13.2c.8 1.3 2 2 3.5 2s2.7-.7 3.5-2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
      <path d="M9 10.1h.01M15 10.1h.01" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
    </svg>
  `,
  sparkle: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 3.5 13.8 8l4.5 1.8-4.5 1.8L12 16l-1.8-4.4L5.7 9.8 10.2 8Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
      <path d="M18.5 13.5 19.2 15.2 21 15.9l-1.8.7-.7 1.7-.7-1.7-1.8-.7 1.8-.7Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
    </svg>
  `,
  calendar: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="none" stroke="currentColor" stroke-width="1.7" />
      <path d="M7 3.8v3.1M17 3.8v3.1M3.5 9.5h17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
      <path d="M8 13h3M13 13h3M8 16h3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
    </svg>
  `,
  map: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 21s5.4-5.1 5.4-10.3A5.4 5.4 0 1 0 6.6 10.7C6.6 15.9 12 21 12 21Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
      <circle cx="12" cy="10.3" r="1.8" fill="none" stroke="currentColor" stroke-width="1.7" />
    </svg>
  `,
  clock: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="1.7" />
      <path d="M12 8.2V12l2.7 1.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `,
  phone: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7.5 4.5c.8 0 1.5.3 2 .9l1.7 2.1c.5.6.6 1.4.3 2l-.9 1.8c1 1.9 2.7 3.7 4.6 4.6l1.8-.9c.6-.3 1.4-.2 2 .3l2.1 1.7c.6.5.9 1.2.9 2 0 .8-.3 1.6-.9 2.1l-1 1c-.7.7-1.7 1-2.7.8-3.1-.5-6.1-2.2-8.9-5-2.8-2.8-4.5-5.8-5-8.9-.2-1 .1-2 .8-2.7l1-1c.5-.6 1.3-.9 2.1-.9Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
    </svg>
  `,
  notes: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6 3.5h9L18.5 7V20.5H6Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
      <path d="M9 10h6M9 13h6M9 16h4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
    </svg>
  `,
  arrow: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M6 12h12M13 6l5 6-5 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `
};

function iconMarkup(name) {
  return `<span class="rich-icon rich-icon-${name}" aria-hidden="true">${ICONS[name] || ICONS.sparkle}</span>`;
}

function renderHome(bootstrap) {
  const { clinic } = bootstrap;
  const reservationChannelLabel = (clinic.reservation?.channels || []).join(" / ").toUpperCase() || "WEB予約";

  elements.brandMark.textContent = "AO";
  elements.brandName.textContent = clinic.name;
  elements.brandTag.textContent = "医院サイト";
  elements.heroTitle.textContent = clinic.name;
  elements.heroLead.textContent = `${clinic.name} は、駅から通いやすく、相談しやすさと説明のわかりやすさを大切にしたダミー医院です。予約までの流れを短くし、家族で通うイメージがしやすい構成にしています。`;
  elements.heroBadges.innerHTML = [
    { icon: "clock", label: `平日 ${clinic.hours.weekday}` },
    { icon: "calendar", label: `土曜 ${clinic.hours.saturday}` },
    { icon: "phone", label: `${reservationChannelLabel} に対応` }
  ]
    .map(
      (item) => `
        <span class="hero-badge">
          ${iconMarkup(item.icon)}
          <span>${escapeHtml(item.label)}</span>
        </span>
      `
    )
    .join("");
  elements.clinicMeta.innerHTML = `
    <div class="info-chip info-chip-icon">${iconMarkup("map")}<strong>${escapeHtml(clinic.address)}</strong></div>
    <div class="info-chip info-chip-icon">${iconMarkup("phone")}<strong>${escapeHtml(clinic.phone)}</strong></div>
    <div class="info-chip info-chip-icon">${iconMarkup("clock")}<strong>平日 ${escapeHtml(clinic.hours.weekday)} / 土曜 ${escapeHtml(clinic.hours.saturday)}</strong></div>
  `;
  elements.accessSummary.innerHTML = `
    <div class="hero-side-stack">
      <article class="access-card access-card-icon">
        ${iconMarkup("map")}
        <div>
          <small>アクセス</small>
          <strong>${escapeHtml(clinic.address)}</strong>
          <p>生活導線の中で通いやすい場所にある、という印象を先に伝えます。</p>
        </div>
      </article>
      <article class="access-card access-card-icon">
        ${iconMarkup("clock")}
        <div>
          <small>診療時間</small>
          <strong>平日 ${escapeHtml(clinic.hours.weekday)} / 土曜 ${escapeHtml(clinic.hours.saturday)}</strong>
          <p>平日夜と土曜の通院イメージがひと目で伝わるようにします。</p>
        </div>
      </article>
      <article class="access-card access-card-icon">
        ${iconMarkup("phone")}
        <div>
          <small>予約</small>
          <strong>${escapeHtml((clinic.reservation?.channels || ["web"]).join(" / "))}</strong>
          <p>WEB予約を主導線に、電話も補助導線として残します。</p>
        </div>
      </article>
    </div>
    <div class="timeline-mini">
      <span>${iconMarkup("calendar")}<span>1. 予約</span></span>
      <span>${iconMarkup("tooth")}<span>2. 受診</span></span>
      <span>${iconMarkup("shield")}<span>3. 継続管理</span></span>
    </div>
  `;

  const symptomCards = [
    {
      icon: "tooth",
      title: "歯が痛い / しみる",
      copy: "虫歯や神経の炎症が気になる方の入口です。"
    },
    {
      icon: "shield",
      title: "歯ぐきの出血 / 口臭",
      copy: "歯周病の相談やメンテナンス希望に向いています。"
    },
    {
      icon: "notes",
      title: "親知らずが気になる",
      copy: "腫れや違和感、抜歯相談をまとめて確認できます。"
    },
    {
      icon: "smile",
      title: "歯並びが気になる",
      copy: "矯正相談や見た目の悩みを早めに整理できます。"
    },
    {
      icon: "sparkle",
      title: "白くしたい / 審美相談",
      copy: "ホワイトニングや前歯の見た目相談を案内します。"
    },
    {
      icon: "calendar",
      title: "定期検診 / クリーニング",
      copy: "予防歯科の継続通院を想定した導線です。"
    }
  ];

  elements.symptomGrid.innerHTML = symptomCards
    .map(
      (item) => `
        <article class="mini-card symptom-card rich-card reveal-card" data-reveal>
          <div class="rich-card-head">
            ${iconMarkup(item.icon)}
            <div>
              <p class="card-kicker">症状から探す</p>
              <h3>${escapeHtml(item.title)}</h3>
            </div>
          </div>
          <p>${escapeHtml(item.copy)}</p>
        </article>
      `
    )
    .join("");

  elements.landingHighlights.innerHTML = clinic.highlights
    .map(
      (item, index) => {
        const icons = ["map", "notes", "shield"];
        return `
        <article class="mini-card feature-card rich-card reveal-card" data-reveal>
          <div class="rich-card-head">
            ${iconMarkup(icons[index] || "sparkle")}
            <div>
              <p class="card-kicker">医院の特徴</p>
              <h3>${escapeHtml(item)}</h3>
            </div>
          </div>
          <p>患者が最初に知りたい情報を、短く落ち着いたトーンでまとめます。</p>
        </article>
        `;
      }
    )
    .join("");

  elements.serviceGrid.innerHTML = clinic.services
    .map(
      (service, index) => {
        const icons = ["tooth", "shield", "sparkle", "smile", "notes"];
        return `
        <article class="mini-card menu-card rich-card reveal-card" data-reveal>
          <div class="rich-card-head">
            ${iconMarkup(icons[index] || "calendar")}
            <div>
              <p class="card-kicker">診療案内</p>
              <h3>${escapeHtml(service)}</h3>
            </div>
          </div>
          <p>相談の入り口をやわらかくして、予約へ自然に進める構成です。</p>
        </article>
        `;
      }
    )
    .join("");

  elements.galleryGrid.innerHTML = [
    {
      src: "/assets/clinic-lounge.png",
      title: "受付と待合",
      copy: "清潔感と落ち着きが伝わる待合イメージ。"
    },
    {
      src: "/assets/xray-consultation.png",
      title: "レントゲン説明",
      copy: "説明しやすい空気感を、少し引いた構図で。"
    }
  ]
    .map(
      (item) => `
        <article class="gallery-card rich-gallery-card reveal-card" data-reveal>
          <div class="gallery-visual">
            <img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.title)}" />
            <span class="gallery-badge">${iconMarkup("sparkle")}<span>photo</span></span>
          </div>
          <div class="gallery-copy">
            <p class="card-kicker">院内イメージ</p>
            <h3>${escapeHtml(item.title)}</h3>
            <p>${escapeHtml(item.copy)}</p>
          </div>
        </article>
      `
    )
    .join("");

  elements.faqGrid.innerHTML = clinic.faq
    .map(
      (item) => `
        <article class="faq-card faq-item rich-card reveal-card" data-reveal>
          <div class="rich-card-head">
            ${iconMarkup("calendar")}
            <div>
              <p class="card-kicker">よくある質問</p>
              <h3>${escapeHtml(item.question)}</h3>
            </div>
          </div>
          <p>${escapeHtml(item.answer)}</p>
        </article>
      `
    )
    .join("");
}

function attachRevealAnimation() {
  const targets = Array.from(document.querySelectorAll("[data-reveal]"));
  if (!targets.length) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }
    },
    {
      threshold: 0.18,
      rootMargin: "0px 0px -8% 0px"
    }
  );

  for (const target of targets) {
    observer.observe(target);
  }
}

async function init() {
  const bootstrap = await apiFetch("/api/bootstrap");
  renderHome(bootstrap);
  attachRevealAnimation();
}

init().catch((error) => {
  console.error(error);
});
