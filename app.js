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
  {
    name: "開店作業",
    status: "×",
    subskills: [
      { name: "レジ開", status: "×" },
      { name: "クリンネス", status: "×" },
      { name: "テレビBGM電気", status: "×" }
    ]
  },
  {
    name: "閉店作業",
    status: "×",
    subskills: [
      { name: "レジ締め", status: "×" },
      { name: "PC入力", status: "×" },
      { name: "WS書込み", status: "×" },
      { name: "日報一言メモ", status: "×" }
    ]
  },
  { name: "レジ操作", status: "×" },
  { name: "店内用バッグ渡し", status: "×" },
  { name: "商品補充", status: "×" },
  { name: "ストック整理", status: "×" },
  { name: "売場作成", status: "×" },
  { name: "マネキン着せ替え", status: "×" },
  { name: "特売準備", status: "×" },
  { name: "電話対応", status: "×" },
  { name: "清掃／クリンネス", status: "×" },
  { name: "レジ締め", status: "×" },
  { name: "入荷処理", status: "×" },
  { name: "開店準備", status: "×" },
  { name: "マークダウン作業", status: "×" },
  { name: "フィッティング対応", status: "×" },
  { name: "ZOZO集約", status: "×" }
];

const STATUS_ORDER = ["×", "△", "〇"];

const statusMeta = {
  "〇": { className: "good", label: "一人で問題なくできる" },
  "△": { className: "almost", label: "教えたばかり／一人では完結できない" },
  "×": { className: "notyet", label: "まだ教えていない" }
};

const RANK_OPTIONS = ["JS", "S", "SS", "TR", "SM"];
const DEFAULT_RANK = "JS";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const staffCollection = collection(db, "staff");

enableIndexedDbPersistence(db).catch(() => {});

let state = { staff: [] };
let currentStaffId = null;
let modalMode = null;
let modalPayload = null;
let subskillModalMode = null;
let subskillModalPayload = null;

const elements = {
  pageTitle: document.querySelector("#pageTitle"),
  backBtn: document.querySelector("#backBtn"),
  listView: document.querySelector("#listView"),
  detailView: document.querySelector("#detailView"),
  staffList: document.querySelector("#staffList"),
  emptyStaff: document.querySelector("#emptyStaff"),
  staffTotal: document.querySelector("#staffTotal"),
  addStaffBtn: document.querySelector("#addStaffBtn"),
  staffNameTitle: document.querySelector("#staffNameTitle"),
  staffRankBadge: document.querySelector("#staffRankBadge"),
  renameStaffBtn: document.querySelector("#renameStaffBtn"),
  editRankBtn: document.querySelector("#editRankBtn"),
  deleteStaffBtn: document.querySelector("#deleteStaffBtn"),
  addSkillBtn: document.querySelector("#addSkillBtn"),
  skillList: document.querySelector("#skillList"),
  modal: document.querySelector("#modal"),
  modalTitle: document.querySelector("#modalTitle"),
  modalLabel: document.querySelector("#modalLabel"),
  modalTextWrap: document.querySelector("#modalTextWrap"),
  modalRankWrap: document.querySelector("#modalRankWrap"),
  modalInput: document.querySelector("#modalInput"),
  modalRankSelect: document.querySelector("#modalRankSelect"),
  cancelModalBtn: document.querySelector("#cancelModalBtn"),
  saveModalBtn: document.querySelector("#saveModalBtn"),
  subskillModal: document.querySelector("#subskillModal"),
  subskillModalTitle: document.querySelector("#subskillModalTitle"),
  subskillModalLabel: document.querySelector("#subskillModalLabel"),
  subskillModalInput: document.querySelector("#subskillModalInput"),
  cancelSubskillModalBtn: document.querySelector("#cancelSubskillModalBtn"),
  saveSubskillModalBtn: document.querySelector("#saveSubskillModalBtn"),
  toast: document.querySelector("#toast"),
  syncDot: document.querySelector("#syncDot"),
  syncText: document.querySelector("#syncText")
};

function createId() {
  return crypto?.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

function createInitialSkills() {
  return INITIAL_SKILLS.map((skill) => ({
    id: createId(),
    name: skill.name,
    status: skill.status || "×",
    subskills: Array.isArray(skill.subskills)
      ? skill.subskills.map((subskill) => ({
          id: createId(),
          name: subskill.name,
          status: subskill.status || "×"
        }))
      : []
  }));
}

function normalizeSubskills(subskills) {
  return Array.isArray(subskills)
    ? subskills.map((subskill) => ({
        id: subskill.id || createId(),
        name: subskill.name || "",
        status: subskill.status || "×"
      }))
    : [];
}

function normalizeSkills(skills) {
  return Array.isArray(skills)
    ? skills.map((skill) => ({
        id: skill.id || createId(),
        name: skill.name || "",
        status: skill.status || "×",
        subskills: normalizeSubskills(skill.subskills)
      }))
    : [];
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
          rank: RANK_OPTIONS.includes(data.rank) ? data.rank : DEFAULT_RANK,
          skills: normalizeSkills(data.skills),
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
  elements.emptyStaff.classList.toggle("hidden", state.staff.length !== 0);

  state.staff.forEach((staff) => {
    const counts = countStatuses(staff.skills);
    const button = document.createElement("button");
    button.className = "staff-card";
    button.type = "button";
    button.innerHTML = `
      <div>
        <div class="staff-name-row">
          <span class="staff-name">${escapeHtml(staff.name)}</span>
          <span class="staff-rank-inline">${escapeHtml(staff.rank || DEFAULT_RANK)}</span>
        </div>
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
  elements.staffRankBadge.textContent = staff.rank || DEFAULT_RANK;
  elements.staffRankBadge.classList.remove("hidden");
  elements.skillList.innerHTML = "";

  staff.skills.forEach((skill) => {
    const meta = statusMeta[skill.status] || statusMeta["×"];
    const hasSubskills = skill.name === "開店作業" || skill.name === "閉店作業";
    const isExpanded = Boolean(skill.isExpanded);

    const card = document.createElement("div");
    card.className = "skill-card";

    const subskillButtonHtml = hasSubskills
      ? `<button class="toggle-subskills-btn" type="button">${isExpanded ? "詳細を閉じる" : "詳細を見る"}</button>`
      : "";

    const subskillsHtml = hasSubskills && isExpanded
      ? `
        <div class="subskill-panel">
          <div class="subskill-header">
            <span class="subskill-title">${escapeHtml(skill.name)}の詳細スキル</span>
            <button class="sub-btn add-subskill-btn" type="button">＋ 詳細追加</button>
          </div>
          <div class="subskill-list">
            ${skill.subskills.length === 0 ? `<div class="subskill-empty">まだ詳細スキルがありません</div>` : ""}
          </div>
        </div>
      `
      : "";

    card.innerHTML = `
      <div class="skill-block">
        <div class="skill-main">
          <div class="skill-left">
            <div class="skill-title">${escapeHtml(skill.name)}</div>
          </div>
          <div class="skill-controls">
            ${subskillButtonHtml}
            <button class="badge ${meta.className}" type="button" title="${meta.label}" aria-label="${skill.name}：${meta.label}">
              ${skill.status}
            </button>
            <button class="mini-btn edit-skill" type="button" aria-label="${skill.name}を編集">編集</button>
            <button class="mini-btn delete-skill" type="button" aria-label="${skill.name}を削除">削除</button>
          </div>
        </div>
        ${subskillsHtml}
      </div>
    `;

    bindPress(card.querySelector(".badge"), () => toggleSkillStatus(skill.id));
    bindPress(card.querySelector(".edit-skill"), () => openModal("editSkill", { skillId: skill.id }));
    bindPress(card.querySelector(".delete-skill"), () => deleteSkill(skill.id));

    if (hasSubskills) {
      bindPress(card.querySelector(".toggle-subskills-btn"), () => toggleSubskillPanel(skill.id));

      if (isExpanded) {
        bindPress(card.querySelector(".add-subskill-btn"), () => openSubskillModal("addSubskill", { skillId: skill.id }));
        const subskillList = card.querySelector(".subskill-list");

        skill.subskills.forEach((subskill) => {
          const subMeta = statusMeta[subskill.status] || statusMeta["×"];
          const row = document.createElement("div");
          row.className = "subskill-card";
          row.innerHTML = `
            <div class="subskill-name">${escapeHtml(subskill.name)}</div>
            <div class="subskill-controls">
              <button class="badge ${subMeta.className}" type="button" title="${subMeta.label}" aria-label="${subskill.name}：${subMeta.label}">
                ${subskill.status}
              </button>
              <button class="mini-btn edit-subskill" type="button">編集</button>
              <button class="mini-btn delete-subskill" type="button">削除</button>
            </div>
          `;
          bindPress(row.querySelector(".badge"), () => toggleSubskillStatus(skill.id, subskill.id));
          bindPress(row.querySelector(".edit-subskill"), () => openSubskillModal("editSubskill", { skillId: skill.id, subskillId: subskill.id }));
          bindPress(row.querySelector(".delete-subskill"), () => deleteSubskill(skill.id, subskill.id));
          subskillList.appendChild(row);
        });
      }
    }

    elements.skillList.appendChild(card);
  });
}


function preserveExpandedState(newSkills, previousSkills = []) {
  return newSkills.map((skill) => {
    const prev = previousSkills.find((item) => item.id === skill.id || item.name === skill.name);
    return {
      ...skill,
      isExpanded: Boolean(prev?.isExpanded)
    };
  });
}

function toggleSubskillPanel(skillId) {
  const staff = getCurrentStaff();
  if (!staff) return;
  staff.skills = staff.skills.map((skill) =>
    skill.id === skillId ? { ...skill, isExpanded: !skill.isExpanded } : skill
  );
  renderDetail();
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

async function addStaff(name, rank = DEFAULT_RANK) {
  await addDoc(staffCollection, {
    name,
    rank,
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

async function updateRank(rank) {
  const staff = getCurrentStaff();
  if (!staff) return;

  await updateDoc(staffDoc(staff.id), {
    rank,
    updatedAt: serverTimestamp()
  });
  showToast("等級を更新しました");
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

  const updatedSkills = preserveExpandedState([
    ...staff.skills,
    {
      id: createId(),
      name,
      status: "×",
      subskills: []
    }
  ], staff.skills);

  await updateDoc(staffDoc(staff.id), {
    skills: updatedSkills.map(({ isExpanded, ...skill }) => skill),
    updatedAt: serverTimestamp()
  });
  showToast("スキルを追加しました");
}

async function editSkill(skillId, name) {
  const staff = getCurrentStaff();
  if (!staff) return;

  const updatedSkills = preserveExpandedState(
    staff.skills.map((skill) =>
      skill.id === skillId ? { ...skill, name } : skill
    ),
    staff.skills
  );

  await updateDoc(staffDoc(staff.id), {
    skills: updatedSkills.map(({ isExpanded, ...skill }) => skill),
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

  const updatedSkills = preserveExpandedState(
    staff.skills.filter((item) => item.id !== skillId),
    staff.skills
  );

  await updateDoc(staffDoc(staff.id), {
    skills: updatedSkills.map(({ isExpanded, ...skill }) => skill),
    updatedAt: serverTimestamp()
  });
  showToast("スキルを削除しました");
}

async function toggleSkillStatus(skillId) {
  const staff = getCurrentStaff();
  if (!staff) return;

  const updatedSkills = preserveExpandedState(
    staff.skills.map((skill) => {
      if (skill.id !== skillId) return skill;
      const currentIndex = STATUS_ORDER.indexOf(skill.status);
      return {
        ...skill,
        status: STATUS_ORDER[(currentIndex + 1) % STATUS_ORDER.length]
      };
    }),
    staff.skills
  );

  await updateDoc(staffDoc(staff.id), {
    skills: updatedSkills.map(({ isExpanded, ...skill }) => skill),
    updatedAt: serverTimestamp()
  });
}


async function addSubskill(skillId, name) {
  const staff = getCurrentStaff();
  if (!staff) return;

  const updatedSkills = preserveExpandedState(
    staff.skills.map((skill) =>
      skill.id === skillId
        ? {
            ...skill,
            subskills: [...normalizeSubskills(skill.subskills), { id: createId(), name, status: "×" }],
            isExpanded: true
          }
        : skill
    ),
    staff.skills
  );

  await updateDoc(staffDoc(staff.id), {
    skills: updatedSkills.map(({ isExpanded, ...skill }) => skill),
    updatedAt: serverTimestamp()
  });
  showToast("詳細スキルを追加しました");
}

async function editSubskill(skillId, subskillId, name) {
  const staff = getCurrentStaff();
  if (!staff) return;

  const updatedSkills = preserveExpandedState(
    staff.skills.map((skill) =>
      skill.id === skillId
        ? {
            ...skill,
            subskills: normalizeSubskills(skill.subskills).map((subskill) =>
              subskill.id === subskillId ? { ...subskill, name } : subskill
            ),
            isExpanded: true
          }
        : skill
    ),
    staff.skills
  );

  await updateDoc(staffDoc(staff.id), {
    skills: updatedSkills.map(({ isExpanded, ...skill }) => skill),
    updatedAt: serverTimestamp()
  });
  showToast("詳細スキル名を更新しました");
}

async function deleteSubskill(skillId, subskillId) {
  const staff = getCurrentStaff();
  if (!staff) return;

  const targetSkill = staff.skills.find((skill) => skill.id === skillId);
  const subskill = targetSkill?.subskills?.find((item) => item.id === subskillId);
  if (!subskill) return;

  if (!confirm(`「${subskill.name}」を削除しますか？`)) return;

  const updatedSkills = preserveExpandedState(
    staff.skills.map((skill) =>
      skill.id === skillId
        ? {
            ...skill,
            subskills: normalizeSubskills(skill.subskills).filter((subskill) => subskill.id !== subskillId),
            isExpanded: true
          }
        : skill
    ),
    staff.skills
  );

  await updateDoc(staffDoc(staff.id), {
    skills: updatedSkills.map(({ isExpanded, ...skill }) => skill),
    updatedAt: serverTimestamp()
  });
  showToast("詳細スキルを削除しました");
}

async function toggleSubskillStatus(skillId, subskillId) {
  const staff = getCurrentStaff();
  if (!staff) return;

  const updatedSkills = preserveExpandedState(
    staff.skills.map((skill) => {
      if (skill.id !== skillId) return skill;
      return {
        ...skill,
        subskills: normalizeSubskills(skill.subskills).map((subskill) => {
          if (subskill.id !== subskillId) return subskill;
          const currentIndex = STATUS_ORDER.indexOf(subskill.status);
          return {
            ...subskill,
            status: STATUS_ORDER[(currentIndex + 1) % STATUS_ORDER.length]
          };
        }),
        isExpanded: true
      };
    }),
    staff.skills
  );

  await updateDoc(staffDoc(staff.id), {
    skills: updatedSkills.map(({ isExpanded, ...skill }) => skill),
    updatedAt: serverTimestamp()
  });
}

function openSubskillModal(mode, payload = null) {
  subskillModalMode = mode;
  subskillModalPayload = payload;

  const staff = getCurrentStaff();
  const skill = staff?.skills.find((item) => item.id === payload.skillId);
  const subskill = skill?.subskills?.find((item) => item.id === payload.subskillId);

  elements.subskillModalTitle.textContent = mode === "addSubskill" ? "詳細スキル追加" : "詳細スキル編集";
  elements.subskillModalLabel.textContent = `${skill?.name || ""}の詳細スキル名`;
  elements.subskillModalInput.value = mode === "editSubskill" ? (subskill?.name || "") : "";
  elements.subskillModal.classList.remove("hidden");
  setTimeout(() => elements.subskillModalInput.focus(), 50);
}

function closeSubskillModal() {
  subskillModalMode = null;
  subskillModalPayload = null;
  elements.subskillModal.classList.add("hidden");
  elements.subskillModalInput.value = "";
}

async function saveSubskillModal() {
  const value = elements.subskillModalInput.value.trim();
  if (!value) {
    showToast("入力してください");
    return;
  }

  try {
    if (subskillModalMode === "addSubskill") {
      await addSubskill(subskillModalPayload.skillId, value);
    }
    if (subskillModalMode === "editSubskill") {
      await editSubskill(subskillModalPayload.skillId, subskillModalPayload.subskillId, value);
    }
    closeSubskillModal();
  } catch (error) {
    console.error(error);
    showToast("保存できませんでした");
  }
}

function openModal(mode, payload = null) {
  modalMode = mode;
  modalPayload = payload;

  const staff = getCurrentStaff();
  let title = "";
  let label = "";
  let value = "";
  let rankValue = DEFAULT_RANK;
  let useRankSelect = false;

  if (mode === "addStaff") {
    title = "スタッフ追加";
    label = "スタッフ名";
    value = "";
    rankValue = DEFAULT_RANK;
    useRankSelect = false;
  }

  if (mode === "renameStaff" && staff) {
    title = "スタッフ名編集";
    label = "スタッフ名";
    value = staff.name;
  }

  if (mode === "editRank" && staff) {
    title = "等級変更";
    label = "スタッフ等級";
    rankValue = staff.rank || DEFAULT_RANK;
    useRankSelect = true;
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
  elements.modalRankSelect.value = rankValue;
  elements.modalTextWrap.classList.toggle("hidden", useRankSelect);
  elements.modalRankWrap.classList.toggle("hidden", !useRankSelect);
  elements.modal.classList.remove("hidden");
  setTimeout(() => {
    if (useRankSelect) {
      elements.modalRankSelect.focus();
    } else {
      elements.modalInput.focus();
    }
  }, 50);
}

function closeModal() {
  modalMode = null;
  modalPayload = null;
  elements.modal.classList.add("hidden");
  elements.modalInput.value = "";
  elements.modalRankSelect.value = DEFAULT_RANK;
  elements.modalTextWrap.classList.remove("hidden");
  elements.modalRankWrap.classList.add("hidden");
}

async function saveModal() {
  const value = elements.modalInput.value.trim();
  const rankValue = elements.modalRankSelect.value;

  if (modalMode === "addStaff" && !value) {
    showToast("スタッフ名を入力してください");
    return;
  }

  if ((modalMode === "renameStaff" || modalMode === "addSkill" || modalMode === "editSkill") && !value) {
    showToast("入力してください");
    return;
  }

  try {
    if (modalMode === "addStaff") await addStaff(value, DEFAULT_RANK);
    if (modalMode === "renameStaff") await renameStaff(value);
    if (modalMode === "editRank") await updateRank(rankValue);
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


function bindPress(target, handler) {
  if (!target) return;
  target.addEventListener("click", handler);
  target.addEventListener("touchend", (event) => {
    event.preventDefault();
    handler(event);
  }, { passive: false });
}

function escapeHtml(text) {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

elements.addStaffBtn && bindPress(elements.addStaffBtn, () => openModal("addStaff"));
elements.backBtn && bindPress(elements.backBtn, showList);
elements.renameStaffBtn && bindPress(elements.renameStaffBtn, () => openModal("renameStaff"));
elements.editRankBtn && bindPress(elements.editRankBtn, () => openModal("editRank"));
elements.deleteStaffBtn && bindPress(elements.deleteStaffBtn, deleteStaff);
elements.addSkillBtn && bindPress(elements.addSkillBtn, () => openModal("addSkill"));
elements.cancelModalBtn && bindPress(elements.cancelModalBtn, closeModal);
elements.saveModalBtn && bindPress(elements.saveModalBtn, saveModal);
elements.cancelSubskillModalBtn && bindPress(elements.cancelSubskillModalBtn, closeSubskillModal);
elements.saveSubskillModalBtn && bindPress(elements.saveSubskillModalBtn, saveSubskillModal);

elements.modal.addEventListener("click", (event) => {
  if (event.target === elements.modal) closeModal();
});

elements.modalInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") saveModal();
  if (event.key === "Escape") closeModal();
});

elements.subskillModal.addEventListener("click", (event) => {
  if (event.target === elements.subskillModal) closeSubskillModal();
});

elements.subskillModalInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") saveSubskillModal();
  if (event.key === "Escape") closeSubskillModal();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.warn("Service Worker registration failed:", error);
    });
  });
}

renderStaffList();
