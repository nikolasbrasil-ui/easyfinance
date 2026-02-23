/* =========================================================
   Finanças - Organizador de Dívidas
   - CRUD local (LocalStorage)
   - Exibição segura (máscara de cartão)
   - Filtros / Ordenação
   - Exportar / Importar JSON
   - Preparado para futura API (apiClient)
   ========================================================= */

/** ===========================
 *  Config / Constantes
 *  =========================== */
const STORAGE_KEY = "financas_debts_v1";

/**
 * Estrutura de dados (Debt):
 * {
 *   id: string,
 *   title: string,
 *   type: "cartao"|"boleto"|"emprestimo"|"outro",
 *   amountCents: number,
 *   dueDate: string | null,        // "YYYY-MM-DD"
 *   installments: number,
 *   status: "open"|"paid",
 *   cardLast4: string | null,      // guardamos só os 4 últimos
 *   notes: string,
 *   createdAt: string              // ISO
 * }
 */

/** ===========================
 *  (Futuro) API client stub
 *  =========================== */
const apiClient = {
  // Exemplo de endpoints futuros:
  // async listDebts() { return fetch("/api/debts").then(r => r.json()); }
  // async createDebt(payload) { ... }
  // async updateDebt(id, payload) { ... }
  // async deleteDebt(id) { ... }
};

/** ===========================
 *  DOM
 *  =========================== */
const el = {
  year: document.getElementById("year"),

  // Dashboard
  statTotalOpen: document.getElementById("stat-total-open"),
  statTotalOpenMeta: document.getElementById("stat-total-open-meta"),
  statNextDue: document.getElementById("stat-next-due"),
  statNextDueMeta: document.getElementById("stat-next-due-meta"),
  statPaid: document.getElementById("stat-paid"),
  statPaidMeta: document.getElementById("stat-paid-meta"),

  // Form
  form: document.getElementById("debt-form"),
  toast: document.getElementById("toast"),
  inputTitle: document.getElementById("title"),
  inputType: document.getElementById("type"),
  inputAmount: document.getElementById("amount"),
  inputDueDate: document.getElementById("dueDate"),
  inputInstallments: document.getElementById("installments"),
  inputStatus: document.getElementById("status"),
  inputCardNumber: document.getElementById("cardNumber"),
  inputNotes: document.getElementById("notes"),

  errTitle: document.getElementById("err-title"),
  errType: document.getElementById("err-type"),
  errAmount: document.getElementById("err-amount"),
  errStatus: document.getElementById("err-status"),

  // List
  list: document.getElementById("debt-list"),
  emptyState: document.getElementById("empty-state"),
  search: document.getElementById("search"),
  filterStatus: document.getElementById("filterStatus"),
  sortBy: document.getElementById("sortBy"),

  // Tools
  btnExport: document.getElementById("btn-export"),
  fileImport: document.getElementById("file-import"),
  btnClear: document.getElementById("btn-clear"),

  // Modal edit
  editModal: document.getElementById("edit-modal"),
  editForm: document.getElementById("edit-form"),
  btnCloseModal: document.getElementById("btn-close-modal"),
  btnCancelModal: document.getElementById("btn-cancel-modal"),

  editId: document.getElementById("edit-id"),
  editTitle: document.getElementById("edit-title-input"),
  editAmount: document.getElementById("edit-amount-input"),
  editDueDate: document.getElementById("edit-dueDate-input"),
  editStatus: document.getElementById("edit-status-input"),
  editNotes: document.getElementById("edit-notes-input"),

  errEditTitle: document.getElementById("err-edit-title"),
  errEditAmount: document.getElementById("err-edit-amount"),
};

/** ===========================
 *  Estado
 *  =========================== */
let debts = loadDebts();

/** ===========================
 *  Utils
 *  =========================== */
function uid() {
  // id simples; em produção use UUID v4
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function setToast(message) {
  el.toast.textContent = message || "";
  if (!message) return;
  // limpa depois de um tempo (sem animar)
  window.clearTimeout(setToast._t);
  setToast._t = window.setTimeout(() => (el.toast.textContent = ""), 2500);
}

function sanitizeText(value) {
  return String(value || "").trim();
}

/**
 * Converte string tipo "1200,50" ou "1200.50" => centavos
 */
function parseMoneyToCents(input) {
  const raw = sanitizeText(input)
    .replace(/\s/g, "")
    .replace(/\./g, "")        // remove separadores de milhar
    .replace(",", ".");        // normaliza decimal

  const number = Number(raw);
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number * 100);
}

function formatCentsToBRL(cents) {
  const value = (cents || 0) / 100;
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Segurança/privacidade básica:
 * - não armazenamos número completo do cartão
 * - guardamos apenas last4 e exibimos como **** 1234
 */
function extractLast4(cardInput) {
  const digits = sanitizeText(cardInput).replace(/\D/g, "");
  if (!digits) return null;
  const last4 = digits.slice(-4);
  return last4.length === 4 ? last4 : null;
}

function maskLast4(last4) {
  if (!last4) return "—";
  return `**** ${last4}`;
}

function safeDateLabel(isoDate) {
  if (!isoDate) return "—";
  // Mantém simples: data local no padrão BR
  const dt = new Date(isoDate + "T00:00:00");
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("pt-BR");
}

/** ===========================
 *  Storage
 *  =========================== */
function loadDebts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveDebts(next) {
  debts = next;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(debts));
}

/** ===========================
 *  Validação
 *  =========================== */
function clearErrors() {
  el.errTitle.textContent = "";
  el.errType.textContent = "";
  el.errAmount.textContent = "";
  el.errStatus.textContent = "";
  el.errEditTitle.textContent = "";
  el.errEditAmount.textContent = "";
}

function validateCreateForm() {
  clearErrors();
  let ok = true;

  const title = sanitizeText(el.inputTitle.value);
  const type = el.inputType.value;
  const amountCents = parseMoneyToCents(el.inputAmount.value);
  const status = el.inputStatus.value;

  if (!title) {
    el.errTitle.textContent = "Informe uma descrição.";
    ok = false;
  }

  if (!type) {
    el.errType.textContent = "Selecione um tipo.";
    ok = false;
  }

  if (amountCents === null) {
    el.errAmount.textContent = "Informe um valor válido (ex.: 1200,50).";
    ok = false;
  }

  if (!status) {
    el.errStatus.textContent = "Selecione um status.";
    ok = false;
  }

  return ok;
}

function validateEditForm() {
  clearErrors();
  let ok = true;

  const title = sanitizeText(el.editTitle.value);
  const amountCents = parseMoneyToCents(el.editAmount.value);

  if (!title) {
    el.errEditTitle.textContent = "Informe uma descrição.";
    ok = false;
  }
  if (amountCents === null) {
    el.errEditAmount.textContent = "Informe um valor válido (ex.: 1200,50).";
    ok = false;
  }

  return ok;
}

/** ===========================
 *  Render
 *  =========================== */
function getFilteredSortedDebts() {
  const q = sanitizeText(el.search.value).toLowerCase();
  const statusFilter = el.filterStatus.value;
  const sortBy = el.sortBy.value;

  let list = [...debts];

  // filtro status
  if (statusFilter !== "all") {
    list = list.filter((d) => d.status === statusFilter);
  }

  // busca
  if (q) {
    list = list.filter((d) => {
      const hay = `${d.title} ${d.notes || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }

  // ordenação
  const byCreatedAtDesc = (a, b) => (b.createdAt || "").localeCompare(a.createdAt || "");
  const byAmountDesc = (a, b) => (b.amountCents || 0) - (a.amountCents || 0);
  const byDueAsc = (a, b) => {
    const ad = a.dueDate ? a.dueDate : "9999-12-31";
    const bd = b.dueDate ? b.dueDate : "9999-12-31";
    return ad.localeCompare(bd);
  };

  if (sortBy === "createdAtDesc") list.sort(byCreatedAtDesc);
  if (sortBy === "amountDesc") list.sort(byAmountDesc);
  if (sortBy === "dueDateAsc") list.sort(byDueAsc);

  return list;
}

function renderList() {
  const list = getFilteredSortedDebts();
  el.list.innerHTML = "";

  el.emptyState.hidden = list.length !== 0;

  for (const d of list) {
    el.list.appendChild(renderDebtCard(d));
  }
}

function renderDebtCard(debt) {
  const article = document.createElement("article");
  article.className = "debt";
  article.setAttribute("role", "listitem");

  const statusLabel = debt.status === "paid" ? "Quitada" : "Em aberto";
  const statusBadgeClass = debt.status === "paid" ? "badge badge--paid" : "badge badge--open";

  const typeMap = {
    cartao: "Cartão",
    boleto: "Boleto/Conta",
    emprestimo: "Empréstimo",
    outro: "Outro",
  };

  article.innerHTML = `
    <div class="debt__top">
      <h3 class="debt__title">${escapeHtml(debt.title)}</h3>

      <div class="debt__badges">
        <span class="${statusBadgeClass}">${statusLabel}</span>
        <span class="badge">${typeMap[debt.type] || "—"}</span>
        <span class="badge">Parcelas: ${Number(debt.installments || 1)}</span>
      </div>
    </div>

    <div class="debt__meta">
      <div><span class="debt__amount">${formatCentsToBRL(debt.amountCents)}</span></div>
      <div>Vencimento: <strong>${safeDateLabel(debt.dueDate)}</strong></div>
      <div>Cartão/ID: <strong>${maskLast4(debt.cardLast4)}</strong></div>
      ${debt.notes ? `<div>Notas: ${escapeHtml(debt.notes)}</div>` : ""}
    </div>

    <div class="debt__actions" aria-label="Ações da dívida">
      <button class="link-btn" type="button" data-action="toggle" data-id="${debt.id}">
        Marcar como ${debt.status === "paid" ? "em aberto" : "quitada"}
      </button>
      <button class="link-btn" type="button" data-action="edit" data-id="${debt.id}">
        Editar
      </button>
      <button class="link-btn link-btn--danger" type="button" data-action="delete" data-id="${debt.id}">
        Excluir
      </button>
    </div>
  `;

  return article;
}

/**
 * Evita injeção via innerHTML.
 * (Não é substituto de backend seguro; é uma camada local.)
 */
function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** ===========================
 *  Dashboard
 *  =========================== */
function renderDashboard() {
  const open = debts.filter((d) => d.status === "open");
  const paid = debts.filter((d) => d.status === "paid");

  const totalOpenCents = open.reduce((acc, d) => acc + (d.amountCents || 0), 0);
  el.statTotalOpen.textContent = formatCentsToBRL(totalOpenCents);
  el.statTotalOpenMeta.textContent = `${open.length} dívida(s) ativa(s)`;

  el.statPaid.textContent = String(paid.length);
  el.statPaidMeta.textContent = `Total de dívidas finalizadas`;

  // Próximo vencimento (dívidas em aberto com dueDate)
  const next = open
    .filter((d) => d.dueDate)
    .slice()
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];

  if (!next) {
    el.statNextDue.textContent = "—";
    el.statNextDueMeta.textContent = "Nenhuma data cadastrada";
  } else {
    el.statNextDue.textContent = safeDateLabel(next.dueDate);
    el.statNextDueMeta.textContent = next.title;
  }
}

/** ===========================
 *  Actions
 *  =========================== */
function addDebtFromForm() {
  const title = sanitizeText(el.inputTitle.value);
  const type = el.inputType.value;
  const amountCents = parseMoneyToCents(el.inputAmount.value);
  const dueDate = el.inputDueDate.value ? el.inputDueDate.value : null;
  const installments = Math.max(1, Number(el.inputInstallments.value || 1));
  const status = el.inputStatus.value;
  const last4 = extractLast4(el.inputCardNumber.value);
  const notes = sanitizeText(el.inputNotes.value);

  const newDebt = {
    id: uid(),
    title,
    type,
    amountCents,
    dueDate,
    installments,
    status,
    cardLast4: last4,
    notes,
    createdAt: new Date().toISOString(),
  };

  const next = [newDebt, ...debts];
  saveDebts(next);
  el.form.reset();
  setToast("Dívida salva com sucesso.");
}

function toggleStatus(id) {
  const next = debts.map((d) => {
    if (d.id !== id) return d;
    const status = d.status === "paid" ? "open" : "paid";
    return { ...d, status };
  });
  saveDebts(next);
  setToast("Status atualizado.");
}

function deleteDebt(id) {
  const target = debts.find((d) => d.id === id);
  if (!target) return;

  const ok = window.confirm(`Excluir a dívida "${target.title}"?`);
  if (!ok) return;

  const next = debts.filter((d) => d.id !== id);
  saveDebts(next);
  setToast("Dívida excluída.");
}

function openEditModal(id) {
  const target = debts.find((d) => d.id === id);
  if (!target) return;

  clearErrors();
  el.editId.value = target.id;
  el.editTitle.value = target.title;
  el.editAmount.value = ((target.amountCents || 0) / 100).toFixed(2).replace(".", ",");
  el.editDueDate.value = target.dueDate || "";
  el.editStatus.value = target.status;
  el.editNotes.value = target.notes || "";

  el.editModal.showModal();
  // Move foco para o primeiro campo
  el.editTitle.focus();
}

function closeEditModal() {
  if (el.editModal.open) el.editModal.close();
}

function saveEdit() {
  const id = el.editId.value;
  const title = sanitizeText(el.editTitle.value);
  const amountCents = parseMoneyToCents(el.editAmount.value);
  const dueDate = el.editDueDate.value ? el.editDueDate.value : null;
  const status = el.editStatus.value;
  const notes = sanitizeText(el.editNotes.value);

  const next = debts.map((d) => {
    if (d.id !== id) return d;
    return { ...d, title, amountCents, dueDate, status, notes };
  });

  saveDebts(next);
  closeEditModal();
  setToast("Alterações salvas.");
}

/** ===========================
 *  Export / Import
 *  =========================== */
function exportJSON() {
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    debts,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `financas-debts-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
  setToast("Backup exportado em JSON.");
}

async function importJSON(file) {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);

    if (!parsed || !Array.isArray(parsed.debts)) {
      throw new Error("Formato inválido: esperado { debts: [] }");
    }

    // validação básica de campos essenciais
    const normalized = parsed.debts
      .filter((d) => d && typeof d === "object")
      .map((d) => ({
        id: String(d.id || uid()),
        title: sanitizeText(d.title),
        type: d.type || "outro",
        amountCents: Number.isFinite(d.amountCents) ? d.amountCents : 0,
        dueDate: d.dueDate || null,
        installments: Number(d.installments || 1),
        status: d.status === "paid" ? "paid" : "open",
        cardLast4: d.cardLast4 ? String(d.cardLast4).slice(-4) : null,
        notes: sanitizeText(d.notes),
        createdAt: d.createdAt || new Date().toISOString(),
      }))
      .filter((d) => d.title); // exige título

    const ok = window.confirm(
      `Importar ${normalized.length} dívidas? Isso substituirá os dados atuais.`
    );
    if (!ok) return;

    saveDebts(normalized);
    setToast("Importação concluída.");
  } catch (err) {
    setToast("Falha ao importar JSON. Verifique o arquivo.");
    console.error(err);
  } finally {
    el.fileImport.value = "";
  }
}

/** ===========================
 *  Eventos
 *  =========================== */
function onSubmitCreate(e) {
  e.preventDefault();

  if (!validateCreateForm()) {
    setToast("Revise os campos obrigatórios.");
    return;
  }

  addDebtFromForm();
  refreshUI();
}

function onListClick(e) {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const id = btn.getAttribute("data-id");
  const action = btn.getAttribute("data-action");

  if (action === "toggle") toggleStatus(id);
  if (action === "delete") deleteDebt(id);
  if (action === "edit") openEditModal(id);

  refreshUI();
}

function onFiltersChange() {
  renderList();
}

function onEditSubmit(e) {
  e.preventDefault();
  if (!validateEditForm()) {
    setToast("Revise os campos obrigatórios.");
    return;
  }
  saveEdit();
  refreshUI();
}

/** ===========================
 *  Boot
 *  =========================== */
function refreshUI() {
  renderDashboard();
  renderList();
}

function init() {
  el.year.textContent = String(new Date().getFullYear());

  // listeners
  el.form.addEventListener("submit", onSubmitCreate);
  el.list.addEventListener("click", onListClick);

  el.search.addEventListener("input", onFiltersChange);
  el.filterStatus.addEventListener("change", onFiltersChange);
  el.sortBy.addEventListener("change", onFiltersChange);

  el.btnExport.addEventListener("click", exportJSON);
  el.fileImport.addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    if (file) importJSON(file);
  });

  el.btnClear.addEventListener("click", () => {
    const ok = window.confirm("Tem certeza que deseja apagar todas as dívidas deste navegador?");
    if (!ok) return;
    saveDebts([]);
    setToast("Dados apagados.");
    refreshUI();
  });

  // modal
  el.btnCloseModal.addEventListener("click", closeEditModal);
  el.btnCancelModal.addEventListener("click", closeEditModal);
  el.editForm.addEventListener("submit", onEditSubmit);

  // primeira renderização
  refreshUI();
}

init();