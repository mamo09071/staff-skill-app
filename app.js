import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDmuz0tjC4VC5cU4pPLNb6Wm5SdCZF20Cc",
  authDomain: "staff-skill-app.firebaseapp.com",
  projectId: "staff-skill-app",
  storageBucket: "staff-skill-app.firebasestorage.app",
  messagingSenderId: "989925814844",
  appId: "1:989925814844:web:f2dbdb62f24eaaedbcc939"
};

const INITIAL_SKILLS = [
  "レジ操作",
  "返品対応",
  "裾上げ受付",
  "フィッティング案内",
  "店内用バッグ渡し",
  "商品補充",
  "ストック整理",
  "売場作成",
  "マネキン着せ替え",
  "Markdown対応",
  "特売準備",
  "アプリ会員獲得",
  "声かけ接客",
  "電話対応",
  "クレーム一次対応",
  "清掃／クリンネス",
  "朝礼内容の理解",
  "閉店作業"
];

const STATUS_ORDER = ["×", "△", "〇"];

const statusMeta = {
  "〇": { className: "good", label: "一人で問題なくできる" },
  "△": { className: "almost", label: "教えたばかり／一人では完結できない" },
  "×": { className: "notyet", label: "まだ教えていない" }
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const staffCollection = collection(db, "staff");

enableIndexedDbPersistence(db).catch(() => {});

let state = { staff: [] };
let currentStaffId = null;
let modalMode = null;
let modalPayload = null;

const elements = {
  pageTitle: document.querySelector("#pageTitle"),
  backBtn: document.querySelector("#backBtn"),
  listView: document.querySelector("#listView"),
  detailView: document.querySelector("#detailView"),
  staffList: document.querySelector("#staffList"),
  emptyStaff: document.querySelector("#emptyStaff"),
  staffTotal: document.querySelector("#staffTotal"),
  allGoodTotal: document.querySelector("#allGoodTotal"),
  addStaffBtn: document.querySelector("#addStaffBtn"),
  staffNameTitle: document.querySelector("#staffNameTitle"),
  renameStaffBtn: document.querySelector("#renameStaffBtn"),
  deleteStaffBtn: document.querySelector("#deleteStaffBtn"),
  addSkillBtn: document.querySelector("#addSkillBtn"),
  skillList: document.querySelector("#skillList"),
  modal: document.querySelector("#modal"),
  modalTitle: document.querySelector("#modalTitle"),
  modalLabel: document.querySelector("#modalLabel"),
  modalInput: document.querySelector("#modalInput"),
  cancelModalBtn: document.querySelector("#cancelModalBtn"),
  saveModalBtn: document.querySelector("#saveModalBtn"),
  toast: document.querySelector("#toast"),
  syncDot: document.querySelector("#syncDot"),
  syncText: document.querySelector("#syncText")
};

function createId() {
  return crypto?.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function createInitialSkills() {
  return INITIAL_SKILLS.map((name) => ({
    id: createId(),
    name,
    status: "×"
  }));
}

function setSyncStatus(type, text) {
  elements.syncDot.classList.remove("online", "error");
  if (type) elements.syncDot.classList.add(type);
  elements.syncText.textContent = text;
}

onSnapshot(
  staffCollection,
  (snapshot) => {
    state.staff = snapshot.docs
      .map((document) => {
        const data = document.data();
        return {
          id: document.id,
          name: data.name || "",
          skills: Array.isArray(data.skills) ? data.skills : [],
          createdAt: data.createdAt || null
        };
      })
      .filter((staff) => staff.name && staff.skills.length > 0)
      .sort((a, b) => {
        const aTime = a.createdAt?.seconds || 0;
        const bTime = b.createdAt?.seconds || 0;
        return aTime - bTime;
      });

    setSyncStatus("online", "Firebase同期中");
    renderStaffList();
    if (currentStaffId) renderDetail();
  },
  (error) => {
    console.error(error);
    setSyncStatus("error", "接続エラー：ルール設定を確認してください");
    showToast("Firebaseに接続できません");
  }
);

function getCurrentStaff() {
  return state.staff.find((staff) => staff.id === currentStaffId);
}

function staffDoc(staffId) {
  return doc(db, "staff", staffId);
}

function countStatuses(skills) {
  return skills.reduce(
    (acc, skill) => {
      acc[skill.status] = (acc[skill.status] || 0) + 1;
      return acc;
    },
    { "〇": 0, "△": 0, "×": 0 }
  );
}

function renderStaffList() {
  elements.staffList.innerHTML = "";

  elements.staffTotal.textContent = `${state.staff.length}名`;
  const allGood = state.staff.reduce((total, staff) => {
    return total + countStatuses(staff.skills)["〇"];
  }, 0);
  elements.allGoodTotal.textContent = `${allGood}個`;

  elements.emptyStaff.classList.toggle("hidden", state.staff.length !== 0);

  state.staff.forEach((staff) => {
    const counts = countStatuses(staff.skills);
    const button = document.createElement("button");
    button.className = "staff-card";
    button.type = "button";
    button.innerHTML = `
      <div>
        <span class="staff-name">${escapeHtml(staff.name)}</span>
        <div class="count-row">
          <span class="count-pill good">〇 ${counts["〇"]}個</span>
          <span class="count-pill almost">△ ${counts["△"]}個</span>
          <span class="count-pill notyet">× ${counts["×"]}個</span>
        </div>
      </div>
      <span class="chevron">›</span>
    `;
    button.addEventListener("click", () => showDetail(staff.id));
    elements.staffList.appendChild(button);
  });
}

function renderDetail() {
  const staff = getCurrentStaff();
  if (!staff) {
    showList();
    return;
  }

  elements.staffNameTitle.textContent = staff.name;
  elements.skillList.innerHTML = "";

  staff.skills.forEach((skill) => {
    const meta = statusMeta[skill.status] || statusMeta["×"];
    const card = document.createElement("div");
    card.className = "skill-card";
    card.innerHTML = `
      <div class="skill-title">${escapeHtml(skill.name)}</div>
      <div class="skill-controls">
        <button class="badge ${meta.className}" type="button" title="${meta.label}" aria-label="${skill.name}：${meta.label}">
          ${skill.status}
        </button>
        <button class="mini-btn edit-skill" type="button" aria-label="${skill.name}を編集">編集</button>
        <button class="mini-btn delete-skill" type="button" aria-label="${skill.name}を削除">削除</button>
      </div>
    `;

    card.querySelector(".badge").addEventListener("click", () => toggleSkillStatus(skill.id));
    card.querySelector(".edit-skill").addEventListener("click", () => openModal("editSkill", { skillId: skill.id }));
    card.querySelector(".delete-skill").addEventListener("click", () => deleteSkill(skill.id));

    elements.skillList.appendChild(card);
  });
}

function showList() {
  currentStaffId = null;
  elements.pageTitle.textContent = "スタッフスキル管理";
  elements.backBtn.classList.add("hidden");
  elements.listView.classList.remove("hidden");
  elements.detailView.classList.add("hidden");
  renderStaffList();
}

function showDetail(staffId) {
  currentStaffId = staffId;
  elements.pageTitle.textContent = "スキル詳細";
  elements.backBtn.classList.remove("hidden");
  elements.listView.classList.add("hidden");
  elements.detailView.classList.remove("hidden");
  renderDetail();
}

async function addStaff(name) {
  await addDoc(staffCollection, {
    name,
    skills: createInitialSkills(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  showToast("スタッフを追加しました");
}

async function renameStaff(name) {
  const staff = getCurrentStaff();
  if (!staff) return;

  await updateDoc(staffDoc(staff.id), {
    name,
    updatedAt: serverTimestamp()
  });
  showToast("名前を更新しました");
}

async function deleteStaff() {
  const staff = getCurrentStaff();
  if (!staff) return;

  if (!confirm(`${staff.name}さんを削除しますか？\nスキル状況も削除されます。`)) return;

  await deleteDoc(staffDoc(staff.id));
  showList();
  showToast("スタッフを削除しました");
}

async function addSkill(name) {
  const staff = getCurrentStaff();
  if (!staff) return;

  const updatedSkills = [
    ...staff.skills,
    {
      id: createId(),
      name,
      status: "×"
    }
  ];

  await updateDoc(staffDoc(staff.id), {
    skills: updatedSkills,
    updatedAt: serverTimestamp()
  });
  showToast("スキルを追加しました");
}

async function editSkill(skillId, name) {
  const staff = getCurrentStaff();
  if (!staff) return;

  const updatedSkills = staff.skills.map((skill) =>
    skill.id === skillId ? { ...skill, name } : skill
  );

  await updateDoc(staffDoc(staff.id), {
    skills: updatedSkills,
    updatedAt: serverTimestamp()
  });
  showToast("スキル名を更新しました");
}

async function deleteSkill(skillId) {
  const staff = getCurrentStaff();
  if (!staff) return;

  const skill = staff.skills.find((item) => item.id === skillId);
  if (!skill) return;

  if (!confirm(`「${skill.name}」を削除しますか？`)) return;

  const updatedSkills = staff.skills.filter((item) => item.id !== skillId);

  await updateDoc(staffDoc(staff.id), {
    skills: updatedSkills,
    updatedAt: serverTimestamp()
  });
  showToast("スキルを削除しました");
}

async function toggleSkillStatus(skillId) {
  const staff = getCurrentStaff();
  if (!staff) return;

  const updatedSkills = staff.skills.map((skill) => {
    if (skill.id !== skillId) return skill;
    const currentIndex = STATUS_ORDER.indexOf(skill.status);
    return {
      ...skill,
      status: STATUS_ORDER[(currentIndex + 1) % STATUS_ORDER.length]
    };
  });

  await updateDoc(staffDoc(staff.id), {
    skills: updatedSkills,
    updatedAt: serverTimestamp()
  });
}

function openModal(mode, payload = null) {
  modalMode = mode;
  modalPayload = payload;

  const staff = getCurrentStaff();
  let title = "";
  let label = "";
  let value = "";

  if (mode === "addStaff") {
    title = "スタッフ追加";
    label = "スタッフ名";
  }

  if (mode === "renameStaff" && staff) {
    title = "スタッフ名編集";
    label = "スタッフ名";
    value = staff.name;
  }

  if (mode === "addSkill") {
    title = "スキル追加";
    label = "スキル名";
  }

  if (mode === "editSkill" && staff) {
    const skill = staff.skills.find((item) => item.id === payload.skillId);
    title = "スキル編集";
    label = "スキル名";
    value = skill?.name || "";
  }

  elements.modalTitle.textContent = title;
  elements.modalLabel.textContent = label;
  elements.modalInput.value = value;
  elements.modal.classList.remove("hidden");
  setTimeout(() => elements.modalInput.focus(), 50);
}

function closeModal() {
  modalMode = null;
  modalPayload = null;
  elements.modal.classList.add("hidden");
  elements.modalInput.value = "";
}

async function saveModal() {
  const value = elements.modalInput.value.trim();

  if (!value) {
    showToast("入力してください");
    return;
  }

  try {
    if (modalMode === "addStaff") await addStaff(value);
    if (modalMode === "renameStaff") await renameStaff(value);
    if (modalMode === "addSkill") await addSkill(value);
    if (modalMode === "editSkill") await editSkill(modalPayload.skillId, value);
    closeModal();
  } catch (error) {
    console.error(error);
    showToast("保存できませんでした");
  }
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.remove("hidden");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    elements.toast.classList.add("hidden");
  }, 1800);
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

elements.addStaffBtn.addEventListener("click", () => openModal("addStaff"));
elements.backBtn.addEventListener("click", showList);
elements.renameStaffBtn.addEventListener("click", () => openModal("renameStaff"));
elements.deleteStaffBtn.addEventListener("click", deleteStaff);
elements.addSkillBtn.addEventListener("click", () => openModal("addSkill"));
elements.cancelModalBtn.addEventListener("click", closeModal);
elements.saveModalBtn.addEventListener("click", saveModal);

elements.modal.addEventListener("click", (event) => {
  if (event.target === elements.modal) closeModal();
});

elements.modalInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") saveModal();
  if (event.key === "Escape") closeModal();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.warn("Service Worker registration failed:", error);
    });
  });
}

renderStaffList();
