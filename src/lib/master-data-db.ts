import { prisma } from "@/src/lib/prisma";
import {
  CATEGORY_MASTER,
  MESSAGE_TEMPLATE_MASTER,
  ROOM_MASTER,
  type CategoryMaster,
  type RoomMaster,
} from "@/src/lib/master-data";
import type { AppCategoryScope } from "@/src/lib/roles";

export type MasterMessageTemplate = {
  id?: number;
  type: string;
  name: string;
  description: string;
};

export type MasterDataPayload = {
  categories: CategoryMaster[];
  rooms: RoomMaster[];
  messageTemplates: MasterMessageTemplate[];
};

function cloneCategories() {
  return CATEGORY_MASTER.map((category) => ({
    ...category,
    subcategories: category.subcategories.map((subcategory) => ({
      ...subcategory,
      itemTypes: subcategory.itemTypes.map((itemType) => ({ ...itemType })),
    })),
  }));
}

function normalizeCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

export function createMasterCode(value: string) {
  return normalizeCode(value) || `MASTER_${Date.now()}`;
}

function findStaticCategory(category: string) {
  return CATEGORY_MASTER.find(
    (item) => item.value === category || item.code === category,
  );
}

export async function getRoomCodeByNameFromMaster(roomName: string) {
  return (await findActiveRoomByNameFromMaster(roomName))?.code || "";
}

export async function findActiveRoomByNameFromMaster(roomName: string) {
  const normalized = roomName.trim().toLowerCase();

  if (!normalized) return null;

  try {
    const [room, storedRoomCount] = await Promise.all([
      prisma.masterRoom.findFirst({
        where: {
          active: true,
          name: {
            equals: roomName.trim(),
          },
        },
        select: {
          id: true,
          code: true,
          name: true,
        },
      }),
      prisma.masterRoom.count(),
    ]);

    if (room) return room;
    if (storedRoomCount > 0) return null;
  } catch {
    // Fallback below keeps report creation usable if the local DB has not been repaired yet.
  }

  return ROOM_MASTER.find((room) => room.name.toLowerCase() === normalized) || null;
}

export async function findActiveSubcategoryForCategory(
  category: AppCategoryScope,
  subcategoryName: string,
) {
  const normalized = subcategoryName.trim();

  if (!normalized) return null;

  try {
    const [subcategory, storedCategoryCount] = await Promise.all([
      prisma.masterSubcategory.findFirst({
        where: {
          active: true,
          name: { equals: normalized },
          category: {
            active: true,
            code: category,
          },
        },
        select: {
          id: true,
          code: true,
          name: true,
        },
      }),
      prisma.masterCategory.count(),
    ]);

    if (subcategory) return subcategory;
    if (storedCategoryCount > 0) return null;
  } catch {
    // Static fallback below is only used before the master-data migration exists.
  }

  return (
    CATEGORY_MASTER.find((item) => item.value === category)?.subcategories.find(
      (item) => item.name.toLowerCase() === normalized.toLowerCase(),
    ) || null
  );
}

export async function getMasterData(): Promise<MasterDataPayload> {
  const categories = cloneCategories();
  let rooms: RoomMaster[] = [...ROOM_MASTER];
  let messageTemplates: MasterMessageTemplate[] = MESSAGE_TEMPLATE_MASTER.map(
    (template) => ({ ...template }),
  );

  try {
    const [dbCategories, dbRooms, dbTemplates] = await Promise.all([
      prisma.masterCategory.findMany({
        where: { active: true },
        include: {
          subcategories: {
            orderBy: { name: "asc" },
            include: {
              itemTypes: {
                orderBy: { name: "asc" },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      }),
      prisma.masterRoom.findMany({
        orderBy: { name: "asc" },
      }),
      prisma.messageTemplate.findMany({
        orderBy: [{ type: "asc" }, { title: "asc" }],
      }),
    ]);

    for (const target of categories) {
      const dbCategory = dbCategories.find(
        (category) => category.code === target.value,
      );

      if (!dbCategory) continue;

      target.subcategories = dbCategory.subcategories
        .filter((subcategory) => subcategory.active)
        .map((subcategory) => ({
          id: subcategory.id,
          code: subcategory.code,
          name: subcategory.name,
          itemTypes: subcategory.itemTypes
            .filter((itemType) => itemType.active)
            .map((itemType) => ({
              id: itemType.id,
              code: itemType.code,
              name: itemType.name,
            })),
        }));
    }

    if (dbRooms.length > 0) {
      rooms = dbRooms
        .filter((room) => room.active)
        .map((room) => ({ id: room.id, code: room.code, name: room.name }));
    }

    if (dbTemplates.length > 0) {
      messageTemplates = dbTemplates
        .filter((template) => template.active)
        .map((template) => ({
          id: template.id,
          type: template.type,
          name: template.title,
          description: template.body,
        }));
    }
  } catch {
    return {
      categories,
      rooms,
      messageTemplates: MESSAGE_TEMPLATE_MASTER.map((template) => ({ ...template })),
    };
  }

  return { categories, rooms, messageTemplates };
}

export async function ensureMasterCategory(category: AppCategoryScope) {
  const staticCategory = findStaticCategory(category);

  return prisma.masterCategory.upsert({
    where: { code: category },
    update: {
      name: staticCategory?.label || category,
      active: true,
    },
    create: {
      code: category,
      name: staticCategory?.label || category,
      active: true,
    },
  });
}
