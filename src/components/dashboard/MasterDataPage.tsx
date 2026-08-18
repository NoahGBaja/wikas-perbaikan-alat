"use client";

import {
  FormEvent,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type {
  CategoryMaster,
  RoomMaster,
} from "@/src/lib/master-data";
import type { AppCategoryScope } from "@/src/lib/roles";
import {
  FeedbackBanner,
  showError,
  showSuccess,
  toFeedback,
  type FeedbackMessage,
} from "@/src/components/ui/feedback";

type MessageTemplate = {
  id?: number;
  type: string;
  name: string;
  description: string;
};

type TemplateDraft = {
  type: string;
  customType: string;
  name: string;
  description: string;
};

type RoomDraft = {
  name: string;
  code: string;
};

type SubcategoryDraft = {
  category: AppCategoryScope;
  name: string;
  code: string;
};

type MasterDataState = {
  categories: CategoryMaster[];
  rooms: RoomMaster[];
  messageTemplates: MessageTemplate[];
};

type EditImpact = {
  totalReports: number;
  ongoingReports: number;
  historyReports: number;
  futureOnly?: boolean;
};

type PendingEdit = {
  kind: "room" | "subcategory" | "messageTemplate";
  payload: Record<string, unknown>;
  impact: EditImpact;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
};

const EMPTY_MASTER_DATA: MasterDataState = {
  categories: [],
  rooms: [],
  messageTemplates: [],
};

const CUSTOM_TEMPLATE_TYPE = "CUSTOM";
const TEMPLATE_TYPES = [
  { value: "APPROVAL", label: "Persetujuan" },
  { value: "REJECTION", label: "Penolakan" },
  { value: "NOTES", label: "Catatan" },
  { value: "COMPLETION", label: "Penyelesaian" },
  { value: "CUSTOM", label: "Custom" },
];
const MASTER_DATA_TABS = [
  { value: "rooms", label: "Ruangan" },
  { value: "subcategories", label: "Subkategori" },
  { value: "templates", label: "Template Pesan" },
] as const;
type MasterDataTab = (typeof MASTER_DATA_TABS)[number]["value"];
const SECTION_CLASS =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm";
const ADD_BUTTON_CLASS =
  "inline-flex h-11 min-w-[190px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500";

export default function MasterDataPage() {
  const [masterData, setMasterData] = useState<MasterDataState>(EMPTY_MASTER_DATA);
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showSubcategoryModal, setShowSubcategoryModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomMaster | null>(null);
  const [editingSubcategory, setEditingSubcategory] = useState<{
    id?: number;
    category: AppCategoryScope;
    name: string;
    code: string;
  } | null>(null);
  const [editingTemplate, setEditingTemplate] =
    useState<MessageTemplate | null>(null);
  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);
  const [activeTab, setActiveTab] = useState<MasterDataTab>("rooms");
  const [searchTerm, setSearchTerm] = useState("");
  const [roomDraft, setRoomDraft] = useState<RoomDraft>({ name: "", code: "" });
  const [subcategoryDraft, setSubcategoryDraft] = useState<SubcategoryDraft>({
    category: "FASILITAS_INVENTARIS" as AppCategoryScope,
    name: "",
    code: "",
  });
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft>({
    type: "NOTES",
    customType: "",
    name: "",
    description: "",
  });

  async function loadMasterData() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/master-data", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) {
        const text = data.message || "Gagal memuat master data.";
        setMessage(toFeedback(text, "error"));
        showError("Gagal memuat master data", text);
        return;
      }

      setMasterData(data);
    } catch (error) {
      console.error("LOAD_MASTER_DATA_PAGE_ERROR:", error);
      const text = "Terjadi kesalahan saat memuat master data.";
      setMessage(toFeedback(text, "error"));
      showError("Gagal memuat master data", text);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMasterData();
  }, []);

  async function submitEntry(
    event: FormEvent<HTMLFormElement>,
    payload: Record<string, unknown>,
    afterSave: () => void,
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setMessage(null);

      const res = await fetch("/api/admin/master-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      const text = data.message || "Master data berhasil disimpan.";

      if (!res.ok) {
        setMessage(toFeedback(text, "error"));
        showError("Gagal menyimpan master data", text);
        return;
      }

      setMessage(toFeedback(text, "success"));
      showSuccess("Master data disimpan", text);
      setMasterData(data.masterData || masterData);
      afterSave();
    } catch (error) {
      console.error("SAVE_MASTER_DATA_PAGE_ERROR:", error);
      const text = "Terjadi kesalahan saat menyimpan master data.";
      setMessage(toFeedback(text, "error"));
      showError("Gagal menyimpan master data", text);
    } finally {
      setSaving(false);
    }
  }

  function closeEditor(kind: PendingEdit["kind"]) {
    if (kind === "room") {
      setShowRoomModal(false);
      setEditingRoom(null);
      setRoomDraft({ name: "", code: "" });
    } else if (kind === "subcategory") {
      setShowSubcategoryModal(false);
      setEditingSubcategory(null);
      setSubcategoryDraft((current) => ({
        ...current,
        name: "",
        code: "",
      }));
    } else {
      setShowTemplateModal(false);
      setEditingTemplate(null);
      setTemplateDraft({
        type: "NOTES",
        customType: "",
        name: "",
        description: "",
      });
    }
  }

  async function previewEdit(
    event: FormEvent<HTMLFormElement>,
    kind: PendingEdit["kind"],
    payload: Record<string, unknown>,
  ) {
    event.preventDefault();

    try {
      setSaving(true);
      setMessage(null);
      const res = await fetch("/api/admin/master-data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, preview: true }),
      });
      const data = await res.json();
      const text = data.message || "Gagal memeriksa dampak perubahan.";

      if (!res.ok) {
        setMessage(toFeedback(text, "error"));
        showError("Perubahan belum dapat disimpan", text);
        return;
      }

      setPendingEdit({
        kind,
        payload,
        impact: data.impact || {
          totalReports: 0,
          ongoingReports: 0,
          historyReports: 0,
        },
        before: data.before || {},
        after: data.after || {},
      });
    } catch (error) {
      console.error("PREVIEW_MASTER_DATA_EDIT_ERROR:", error);
      const text = "Terjadi kesalahan saat memeriksa dampak perubahan.";
      setMessage(toFeedback(text, "error"));
      showError("Perubahan belum dapat disimpan", text);
    } finally {
      setSaving(false);
    }
  }

  async function confirmEdit() {
    if (!pendingEdit) return;

    try {
      setSaving(true);
      setMessage(null);
      const res = await fetch("/api/admin/master-data", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingEdit.payload),
      });
      const data = await res.json();
      const text = data.message || "Master data berhasil diubah.";

      if (!res.ok) {
        setMessage(toFeedback(text, "error"));
        showError("Gagal mengubah master data", text);
        return;
      }

      setMasterData(data.masterData || masterData);
      setMessage(toFeedback(text, "success"));
      showSuccess("Master data diperbarui", text);
      closeEditor(pendingEdit.kind);
      setPendingEdit(null);
    } catch (error) {
      console.error("CONFIRM_MASTER_DATA_EDIT_ERROR:", error);
      const text = "Terjadi kesalahan saat menyimpan perubahan.";
      setMessage(toFeedback(text, "error"));
      showError("Gagal mengubah master data", text);
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(
    label: string,
    payload: Record<string, unknown>,
    fallbackMessage: string,
  ) {
    const confirmed = window.confirm(`Hapus ${label}?`);

    if (!confirmed) return;

    try {
      setSaving(true);
      setMessage(null);

      const res = await fetch("/api/admin/master-data", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      const text = data.message || fallbackMessage;

      if (!res.ok) {
        setMessage(toFeedback(text, "error"));
        showError("Gagal menghapus master data", text);
        return;
      }

      setMessage(toFeedback(text, "success"));
      showSuccess("Master data dihapus", text);
      setMasterData(data.masterData || masterData);
    } catch (error) {
      console.error("DELETE_MASTER_DATA_PAGE_ERROR:", error);
      const text = "Terjadi kesalahan saat menghapus master data.";
      setMessage(toFeedback(text, "error"));
      showError("Gagal menghapus master data", text);
    } finally {
      setSaving(false);
    }
  }

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const matchesSearch = (...values: Array<string | null | undefined>) => {
    if (!normalizedSearch) return true;

    return values
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch);
  };
  const roomItems = masterData.rooms
    .filter((room) => matchesSearch(room.name, room.code))
    .map((room) => ({
      title: room.name,
      detail: room.code,
      onEdit: room.id
        ? () => {
            setEditingRoom(room);
            setRoomDraft({ name: room.name, code: room.code });
            setShowRoomModal(true);
          }
        : undefined,
      actionLabel: "Hapus",
      onAction: () =>
        void deleteEntry(
          `ruangan "${room.name}"`,
          {
            kind: "room",
            id: room.id,
            name: room.name,
            code: room.code,
          },
          "Data ruangan berhasil dihapus.",
        ),
    }));
  const subcategoryItems = masterData.categories.flatMap((category) =>
    category.subcategories
      .filter((subcategory) =>
        matchesSearch(subcategory.name, subcategory.code, category.label),
      )
      .map((subcategory) => ({
        title: subcategory.name,
        detail: `${category.label} · ${subcategory.code}`,
        onEdit: subcategory.id
          ? () => {
              const target = {
                id: subcategory.id,
                category: category.value,
                name: subcategory.name,
                code: subcategory.code,
              };
              setEditingSubcategory(target);
              setSubcategoryDraft({
                category: target.category,
                name: target.name,
                code: target.code,
              });
              setShowSubcategoryModal(true);
            }
          : undefined,
        actionLabel: "Hapus",
        onAction: () =>
          void deleteEntry(
            `subkategori "${subcategory.name}"`,
            {
              kind: "subcategory",
              id: subcategory.id,
              category: category.value,
              name: subcategory.name,
              code: subcategory.code,
            },
            "Subkategori berhasil dihapus.",
          ),
      })),
  );
  const filteredTemplates = masterData.messageTemplates.filter((template) => {
    const typeLabel =
      TEMPLATE_TYPES.find((type) => type.value === template.type)?.label ||
      template.type;

    return matchesSearch(template.name, template.description, typeLabel);
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-blue-50 px-8 py-10 text-slate-900 sm:px-12 lg:px-20 xl:px-24">
      <div className="mx-auto max-w-screen-2xl">
        <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-blue-600">
              Panel Admin
            </p>
            <h1 className="mt-2 text-3xl font-bold md:text-5xl">
              Master Data
            </h1>
            <p className="mt-3 max-w-3xl text-slate-600">
              Kelola saran isian untuk ruangan, subkategori, dan template pesan
              di alur kerja laporan.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => window.location.assign("/dashboard/admin")}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 shadow-sm transition hover:bg-blue-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Kembali ke Dasbor
            </button>

            <button
              type="button"
              onClick={() => void loadMasterData()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 font-semibold text-slate-700 shadow-sm transition hover:bg-blue-50"
            >
              <RefreshCcw className="h-4 w-4" />
              Muat Ulang
            </button>
          </div>
        </header>

        <FeedbackBanner message={message} className="mb-6" />

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
            Memuat master data...
          </div>
        ) : (
          <section className={SECTION_CLASS}>
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex gap-2 overflow-x-auto rounded-xl bg-slate-100 p-1">
                {MASTER_DATA_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.value);
                      setSearchTerm("");
                    }}
                    className={`h-10 shrink-0 rounded-lg px-4 text-sm font-semibold transition ${
                      activeTab === tab.value
                        ? "bg-white text-blue-700 shadow-sm"
                        : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <label className="flex h-11 w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 shadow-sm focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 xl:max-w-md">
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Cari nama, kode, kategori, atau isi template"
                  className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
                {searchTerm ? (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Hapus pencarian"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </label>
            </div>

            {activeTab === "rooms" ? (
              <TabPanelHeader
                title="Kamus Ruangan"
                description="Nama ruangan akan mengisi kode ruangan otomatis di form laporan."
                buttonLabel="Tambah Ruangan"
                onAdd={() => setShowRoomModal(true)}
              />
            ) : null}
            {activeTab === "rooms" ? <DataList items={roomItems} /> : null}

            {activeTab === "subcategories" ? (
              <TabPanelHeader
                title="Subkategori"
                description="Opsi ini muncul di pilihan subkategori laporan."
                buttonLabel="Tambah Subkategori"
                onAdd={() => setShowSubcategoryModal(true)}
              />
            ) : null}
            {activeTab === "subcategories" ? (
              <DataList items={subcategoryItems} />
            ) : null}

            {activeTab === "templates" ? (
              <TabPanelHeader
                title="Template Pesan"
                description="Template ini muncul sebagai tombol cepat saat admin mengisi catatan."
                buttonLabel="Tambah Template"
                onAdd={() => setShowTemplateModal(true)}
              />
            ) : null}
            {activeTab === "templates" ? (
              <TemplateList
                templates={filteredTemplates}
                onEdit={(template) => {
                  if (!template.id) return;

                  const builtIn = TEMPLATE_TYPES.some(
                    (type) =>
                      type.value !== CUSTOM_TEMPLATE_TYPE &&
                      type.value === template.type,
                  );
                  setEditingTemplate(template);
                  setTemplateDraft({
                    type: builtIn ? template.type : CUSTOM_TEMPLATE_TYPE,
                    customType: builtIn ? "" : template.type,
                    name: template.name,
                    description: template.description,
                  });
                  setShowTemplateModal(true);
                }}
                onDelete={(template) =>
                  void deleteEntry(
                    `template "${template.name}"`,
                    {
                      kind: "messageTemplate",
                      id: template.id,
                      type: template.type,
                      name: template.name,
                      description: template.description,
                    },
                    "Template pesan berhasil dihapus.",
                  )
                }
              />
            ) : null}
          </section>
        )}

        {showRoomModal ? (
          <RoomModal
            mode={editingRoom ? "edit" : "create"}
            draft={roomDraft}
            saving={saving}
            onClose={() => closeEditor("room")}
            onDraftChange={setRoomDraft}
            onSubmit={(event) => {
              const payload = {
                kind: "room",
                ...(editingRoom?.id ? { id: editingRoom.id } : {}),
                ...roomDraft,
              };

              return editingRoom
                ? previewEdit(event, "room", payload)
                : submitEntry(event, payload, () => closeEditor("room"));
            }}
          />
        ) : null}

        {showSubcategoryModal ? (
          <SubcategoryModal
            mode={editingSubcategory ? "edit" : "create"}
            categories={masterData.categories}
            draft={subcategoryDraft}
            saving={saving}
            onClose={() => closeEditor("subcategory")}
            onDraftChange={setSubcategoryDraft}
            onSubmit={(event) => {
              const payload = {
                kind: "subcategory",
                ...(editingSubcategory?.id
                  ? { id: editingSubcategory.id }
                  : {}),
                ...subcategoryDraft,
              };

              return editingSubcategory
                ? previewEdit(event, "subcategory", payload)
                : submitEntry(event, payload, () =>
                    closeEditor("subcategory"),
                  );
            }}
          />
        ) : null}

        {showTemplateModal ? (
          <TemplateModal
            mode={editingTemplate ? "edit" : "create"}
            draft={templateDraft}
            saving={saving}
            onClose={() => closeEditor("messageTemplate")}
            onDraftChange={setTemplateDraft}
            onSubmit={(event) => {
              const payload = {
                kind: "messageTemplate",
                ...(editingTemplate?.id ? { id: editingTemplate.id } : {}),
                ...templateDraft,
              };

              return editingTemplate
                ? previewEdit(event, "messageTemplate", payload)
                : submitEntry(event, payload, () =>
                    closeEditor("messageTemplate"),
                  );
            }}
          />
        ) : null}

        {pendingEdit ? (
          <EditConfirmationModal
            pendingEdit={pendingEdit}
            saving={saving}
            onCancel={() => setPendingEdit(null)}
            onConfirm={() => void confirmEdit()}
          />
        ) : null}
      </div>
    </div>
  );
}

function RoomModal({
  mode,
  draft,
  saving,
  onClose,
  onDraftChange,
  onSubmit,
}: {
  mode: "create" | "edit";
  draft: RoomDraft;
  saving: boolean;
  onClose: () => void;
  onDraftChange: Dispatch<SetStateAction<RoomDraft>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <MasterDataModalFrame
      title={mode === "edit" ? "Edit Ruangan" : "Tambah Ruangan"}
      description={
        mode === "edit"
          ? "Ubah pasangan nama dan kode ruangan. Dampak ke laporan akan ditampilkan sebelum disimpan."
          : "Masukkan nama ruangan dan kode yang akan dipakai otomatis di form laporan."
      }
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label
              htmlFor="master-room-name"
              className="text-sm font-semibold text-slate-700"
            >
              Nama Ruangan
            </label>
            <input
              id="master-room-name"
              value={draft.name}
              onChange={(event) =>
                onDraftChange((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Nama ruangan"
              required
              maxLength={191}
              className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="grid gap-1.5">
            <label
              htmlFor="master-room-code"
              className="text-sm font-semibold text-slate-700"
            >
              Kode Ruangan
            </label>
            <input
              id="master-room-code"
              value={draft.code}
              onChange={(event) =>
                onDraftChange((current) => ({
                  ...current,
                  code: event.target.value,
                }))
              }
              placeholder="Kode ruangan"
              required
              maxLength={191}
              className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
        <ModalActions saving={saving} onClose={onClose} />
      </form>
    </MasterDataModalFrame>
  );
}

function SubcategoryModal({
  mode,
  categories,
  draft,
  saving,
  onClose,
  onDraftChange,
  onSubmit,
}: {
  mode: "create" | "edit";
  categories: CategoryMaster[];
  draft: SubcategoryDraft;
  saving: boolean;
  onClose: () => void;
  onDraftChange: Dispatch<SetStateAction<SubcategoryDraft>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <MasterDataModalFrame
      title={mode === "edit" ? "Edit Subkategori" : "Tambah Subkategori"}
      description={
        mode === "edit"
          ? "Ubah nama atau kategori. Laporan terkait akan disinkronkan setelah konfirmasi."
          : "Tambahkan subkategori baru di bawah kategori yang sesuai."
      }
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label
              htmlFor="master-subcategory-category"
              className="text-sm font-semibold text-slate-700"
            >
              Kategori
            </label>
            <select
              id="master-subcategory-category"
              value={draft.category}
              onChange={(event) =>
                onDraftChange((current) => ({
                  ...current,
                  category: event.target.value as AppCategoryScope,
                }))
              }
              className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              {categories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <label
              htmlFor="master-subcategory-name"
              className="text-sm font-semibold text-slate-700"
            >
              Nama Subkategori
            </label>
            <input
              id="master-subcategory-name"
              value={draft.name}
              onChange={(event) =>
                onDraftChange((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Nama subkategori"
              required
              maxLength={191}
              className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
        <ModalActions saving={saving} onClose={onClose} />
      </form>
    </MasterDataModalFrame>
  );
}

function TemplateModal({
  mode,
  draft,
  saving,
  onClose,
  onDraftChange,
  onSubmit,
}: {
  mode: "create" | "edit";
  draft: TemplateDraft;
  saving: boolean;
  onClose: () => void;
  onDraftChange: Dispatch<SetStateAction<TemplateDraft>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <MasterDataModalFrame
      title={mode === "edit" ? "Edit Template Pesan" : "Tambah Template Pesan"}
      description={
        mode === "edit"
          ? "Ubah jenis, nama, atau deskripsi template untuk penggunaan berikutnya."
          : "Pilih jenis bawaan atau buat jenis custom, lalu isi nama dan deskripsinya."
      }
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
          <div className="grid gap-1.5">
            <label
              htmlFor="master-template-type"
              className="text-sm font-semibold text-slate-700"
            >
              Jenis
            </label>
            <select
              id="master-template-type"
              value={draft.type}
              onChange={(event) =>
                onDraftChange((current) => ({
                  ...current,
                  type: event.target.value,
                }))
              }
              className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              {TEMPLATE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {draft.type === "CUSTOM" ? (
            <div className="grid gap-1.5">
              <label
                htmlFor="master-template-custom-type"
                className="text-sm font-semibold text-slate-700"
              >
                Jenis Custom
              </label>
              <input
                id="master-template-custom-type"
                value={draft.customType}
                onChange={(event) =>
                  onDraftChange((current) => ({
                    ...current,
                    customType: event.target.value,
                  }))
                }
                placeholder="Contoh: Perbaikan Mandiri"
                maxLength={80}
                required
                className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          ) : null}

          <div
            className={`grid gap-1.5 text-sm font-semibold text-slate-700 ${
              draft.type === "CUSTOM" ? "sm:col-span-2" : ""
            }`}
          >
            <label htmlFor="master-template-name">Nama</label>
            <input
              id="master-template-name"
              value={draft.name}
              onChange={(event) =>
                onDraftChange((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder="Contoh: Tolak"
              maxLength={191}
              required
              className="h-11 min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <div className="grid gap-1.5">
          <label
            htmlFor="master-template-description"
            className="text-sm font-semibold text-slate-700"
          >
            Deskripsi
          </label>
          <textarea
            id="master-template-description"
            value={draft.description}
            onChange={(event) =>
              onDraftChange((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            rows={5}
            placeholder="Contoh: Bisa diperbaiki sendiri"
            maxLength={10000}
            required
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-normal outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <ModalActions saving={saving} onClose={onClose} />
      </form>
    </MasterDataModalFrame>
  );
}

function MasterDataModalFrame({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-950">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"
            aria-label="Tutup modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {children}
      </section>
    </div>
  );
}

function EditConfirmationModal({
  pendingEdit,
  saving,
  onCancel,
  onConfirm,
}: {
  pendingEdit: PendingEdit;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const label =
    pendingEdit.kind === "room"
      ? "ruangan"
      : pendingEdit.kind === "subcategory"
        ? "subkategori"
        : "template pesan";
  const beforeText = Object.values(pendingEdit.before)
    .filter((value) => typeof value === "string" && value)
    .join(" · ");
  const afterText = Object.values(pendingEdit.after)
    .filter((value) => typeof value === "string" && value)
    .join(" · ");

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/65 p-4">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="master-edit-confirmation-title"
        className="w-full max-w-xl rounded-2xl border border-amber-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-4">
          <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h2
              id="master-edit-confirmation-title"
              className="text-xl font-bold text-slate-950"
            >
              Konfirmasi edit {label}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Pastikan perubahan berikut sudah benar sebelum disimpan.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
          <div>
            <p className="font-semibold text-slate-500">Sebelum</p>
            <p className="mt-1 break-words font-medium text-slate-900">
              {beforeText || "-"}
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-500">Sesudah</p>
            <p className="mt-1 break-words font-medium text-slate-900">
              {afterText || "-"}
            </p>
          </div>
        </div>

        {pendingEdit.impact.futureOnly ? (
          <p className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm leading-6 text-blue-800">
            Perubahan template berlaku untuk pemakaian berikutnya. Catatan pada
            laporan lama tidak akan ditulis ulang.
          </p>
        ) : (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            Perubahan ini akan menyinkronkan {pendingEdit.impact.totalReports}{" "}
            laporan: {pendingEdit.impact.ongoingReports} masih aktif dan{" "}
            {pendingEdit.impact.historyReports} sudah masuk riwayat.
          </p>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Periksa Lagi
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:opacity-60"
          >
            {saving ? (
              <RefreshCcw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {pendingEdit.impact.futureOnly
              ? "Simpan Perubahan"
              : "Edit & Sinkronkan"}
          </button>
        </div>
      </section>
    </div>
  );
}

function ModalActions({
  saving,
  onClose,
}: {
  saving: boolean;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
      >
        Batal
      </button>
      <SubmitButton saving={saving} />
    </div>
  );
}

function TabPanelHeader({
  title,
  description,
  buttonLabel,
  onAdd,
}: {
  title: string;
  description: string;
  buttonLabel: string;
  onAdd: () => void;
}) {
  return (
    <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-xl font-bold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      <button
        type="button"
        onClick={onAdd}
        className={ADD_BUTTON_CLASS}
      >
        <Plus className="h-4 w-4" />
        {buttonLabel}
      </button>
    </div>
  );
}

function TemplateList({
  templates,
  onEdit,
  onDelete,
}: {
  templates: MessageTemplate[];
  onEdit: (template: MessageTemplate) => void;
  onDelete: (template: MessageTemplate) => void;
}) {
  const labelByType = Object.fromEntries(
    TEMPLATE_TYPES.map((type) => [type.value, type.label]),
  );

  return (
    <div className="mt-5 h-[320px] space-y-2 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-3">
      {templates.length === 0 ? (
        <p className="text-sm text-slate-500">Belum ada template pesan.</p>
      ) : (
        <>
          {templates.map((template) => (
            <article
              key={`${template.type}-${template.name}-${template.id || ""}`}
              className="grid min-h-[76px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2"
            >
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <h3 className="truncate font-semibold text-slate-900">
                    {template.name}
                  </h3>
                  <span className="inline-flex shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                    {labelByType[template.type] || template.type}
                  </span>
                </div>

                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                  {template.description}
                </p>
              </div>

              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(template)}
                  disabled={!template.id}
                  className="inline-flex h-10 items-center justify-center gap-1 rounded-lg border border-blue-100 bg-blue-50 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Edit ${template.name}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(template)}
                  className="inline-flex h-10 items-center justify-center gap-1 rounded-lg border border-rose-100 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                  aria-label={`Hapus ${template.name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Hapus
                </button>
              </div>
            </article>
          ))}
        </>
      )}
    </div>
  );
}

function SubmitButton({
  saving,
  className = "",
}: {
  saving: boolean;
  className?: string;
}) {
  return (
    <button
      type="submit"
      disabled={saving}
      className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto ${className}`}
    >
      {saving ? <RefreshCcw className="h-4 w-4" /> : <Save className="h-4 w-4" />}
      Simpan
    </button>
  );
}

function DataList({
  items,
}: {
  items: {
    title: string;
    detail: string;
    onEdit?: () => void;
    actionLabel?: string;
    onAction?: () => void;
  }[];
}) {
  return (
    <div className="mt-5 h-[320px] space-y-2 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-3">
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Belum ada data.</p>
      ) : (
        items.map((item, index) => (
          <div
            key={`${item.title}-${index}`}
            className="grid min-h-[76px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{item.title}</p>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                {item.detail}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              {item.onEdit ? (
                <button
                  type="button"
                  onClick={item.onEdit}
                  className="inline-flex h-10 items-center justify-center gap-1 rounded-lg border border-blue-100 bg-blue-50 px-3 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                  aria-label={`Edit ${item.title}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </button>
              ) : null}
              {item.onAction ? (
                <button
                  type="button"
                  onClick={item.onAction}
                  className="inline-flex h-10 items-center justify-center gap-1 rounded-lg border border-rose-100 bg-rose-50 px-3 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                  aria-label={`${item.actionLabel || "Hapus"} ${item.title}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {item.actionLabel || "Hapus"}
                </button>
              ) : null}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
