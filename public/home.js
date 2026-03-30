import { apiFetch, escapeHtml } from "/common.js";

const elements = {
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

function renderHome(bootstrap) {
  const { clinic } = bootstrap;
  const reservationChannelLabel = (clinic.reservation?.channels || []).join(" / ").toUpperCase() || "WEB予約";

  elements.heroTitle.textContent = clinic.heroTitle;
  elements.heroLead.textContent = "駅から通いやすく、説明がわかりやすい歯科医院であることを、落ち着いた写真と余白のある構成でまとめました。予約までの導線はできるだけ短く、迷いにくくしています。";
  elements.heroBadges.innerHTML = [
    `平日 ${clinic.hours.weekday}`,
    `土曜 ${clinic.hours.saturday}`,
    `${reservationChannelLabel} に対応`
  ]
    .map((item) => `<span class="hero-badge">${escapeHtml(item)}</span>`)
    .join("");
  elements.clinicMeta.innerHTML = `
    <div class="info-chip"><strong>${escapeHtml(clinic.name)}</strong></div>
    <div class="info-chip">${escapeHtml(clinic.phone)}</div>
    <div class="info-chip">${escapeHtml(clinic.address)}</div>
  `;
  elements.accessSummary.innerHTML = `
    <div class="hero-side-stack">
      <article class="access-card">
        <small>アクセス</small>
        <strong>${escapeHtml(clinic.address)}</strong>
        <p>池袋駅東口からの通いやすさを先に伝えます。</p>
      </article>
      <article class="access-card">
        <small>診療時間</small>
        <strong>平日 ${escapeHtml(clinic.hours.weekday)} / 土曜 ${escapeHtml(clinic.hours.saturday)}</strong>
        <p>平日夜と土曜の通院イメージがひと目で伝わるようにします。</p>
      </article>
      <article class="access-card">
        <small>予約</small>
        <strong>${escapeHtml((clinic.reservation?.channels || ["web"]).join(" / "))}</strong>
        <p>WEB予約を主導線に、電話も補助導線として残します。</p>
      </article>
    </div>
    <div class="timeline-mini">
      <span>1. 予約</span>
      <span>2. 受診</span>
      <span>3. 継続管理</span>
    </div>
  `;

  elements.symptomGrid.innerHTML = [
    {
      title: "歯が痛い / しみる",
      copy: "虫歯や神経の炎症が気になる方の入口です。"
    },
    {
      title: "歯ぐきの出血 / 口臭",
      copy: "歯周病の相談やメンテナンス希望に向いています。"
    },
    {
      title: "親知らずが気になる",
      copy: "腫れや違和感、抜歯相談をまとめて確認できます。"
    },
    {
      title: "歯並びが気になる",
      copy: "矯正相談や見た目の悩みを早めに整理できます。"
    },
    {
      title: "白くしたい / 審美相談",
      copy: "ホワイトニングや前歯の見た目相談を案内します。"
    },
    {
      title: "定期検診 / クリーニング",
      copy: "予防歯科の継続通院を想定した導線です。"
    }
  ]
    .map(
      (item) => `
        <article class="mini-card symptom-card reveal-card" data-reveal>
          <div class="card-icon">+</div>
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.copy)}</p>
        </article>
      `
    )
    .join("");

  elements.landingHighlights.innerHTML = clinic.highlights
    .map(
      (item, index) => `
        <article class="mini-card feature-card reveal-card" data-reveal>
          <span class="feature-index">0${index + 1}</span>
          <h3>${escapeHtml(item)}</h3>
          <p>患者が最初に知りたい情報を、短く落ち着いたトーンでまとめます。</p>
        </article>
      `
    )
    .join("");

  elements.serviceGrid.innerHTML = clinic.services
    .map(
      (service) => `
        <article class="mini-card menu-card reveal-card" data-reveal>
          <h3>${escapeHtml(service)}</h3>
          <p>相談の入り口をやわらかくして、予約へ自然に進める構成です。</p>
        </article>
      `
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
        <article class="gallery-card reveal-card" data-reveal>
          <img src="${escapeHtml(item.src)}" alt="${escapeHtml(item.title)}" />
          <div class="gallery-copy">
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
        <article class="faq-card faq-item reveal-card" data-reveal>
          <h3>${escapeHtml(item.question)}</h3>
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
