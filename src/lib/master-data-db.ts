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
  const normalized = roomName.trim().toLowerCase();

  if (!normalized) return "";

  try {
    const room = await prisma.masterRoom.findFirst({
      where: {
        active: true,
        name: {
          equals: roomName.trim(),
        },
      },
      select: {
        code: true,
      },
    });

    if (room?.code) return room.code;
  } catch {
    // Fallback below keeps report creation usable if the local DB has not been repaired yet.
  }

  return (
    ROOM_MASTER.find((room) => room.name.toLowerCase() === normalized)?.code || ""
  );
}

export async function getMasterData(): Promise<MasterDataPayload> {
  const categories = cloneCategories();
  const rooms: RoomMaster[] = [...ROOM_MASTER];
  const messageTemplates: MasterMessageTemplate[] = [];

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

    const inactiveTemplateKeys = new Set(
      dbTemplates
        .filter((template) => !template.active)
        .map((template) => `${template.type}:${template.title.toLowerCase()}`),
    );

    for (const dbCategory of dbCategories) {
      const target = categories.find(
        (category) =>
          category.value === dbCategory.code || category.code === dbCategory.code,
      );

      if (!target) continue;

      const inactiveSubcategoryKeys = new Set(
        dbCategory.subcategories
          .filter((subcategory) => !subcategory.active)
          .flatMap((subcategory) => [
            `code:${subcategory.code}`,
            `name:${subcategory.name.toLowerCase()}`,
          ]),
      );

      target.subcategories = target.subcategories.filter(
        (subcategory) =>
          !inactiveSubcategoryKeys.has(`code:${subcategory.code}`) &&
          !inactiveSubcategoryKeys.has(`name:${subcategory.name.toLowerCase()}`),
      );

      for (const dbSubcategory of dbCategory.subcategories.filter(
        (subcategory) => subcategory.active,
      )) {
        let targetSubcategory = target.subcategories.find(
          (subcategory) =>
            subcategory.code === dbSubcategory.code ||
            subcategory.name.toLowerCase() === dbSubcategory.name.toLowerCase(),
        );

        if (!targetSubcategory) {
          targetSubcategory = {
            id: dbSubcategory.id,
            code: dbSubcategory.code,
            name: dbSubcategory.name,
            itemTypes: [],
          };
          target.subcategories.push(targetSubcategory);
        } else {
          targetSubcategory.id = dbSubcategory.id;
          targetSubcategory.name = dbSubcategory.name;
        }

        const inactiveItemTypeKeys = new Set(
          dbSubcategory.itemTypes
            .filter((itemType) => !itemType.active)
            .flatMap((itemType) => [
              `code:${itemType.code}`,
              `name:${itemType.name.toLowerCase()}`,
            ]),
        );

        targetSubcategory.itemTypes = targetSubcategory.itemTypes.filter(
          (itemType) =>
            !inactiveItemTypeKeys.has(`code:${itemType.code}`) &&
            !inactiveItemTypeKeys.has(`name:${itemType.name.toLowerCase()}`),
        );

        for (const dbItemType of dbSubcategory.itemTypes.filter(
          (itemType) => itemType.active,
        )) {
          const exists = targetSubcategory.itemTypes.some(
            (itemType) =>
              itemType.code === dbItemType.code ||
              itemType.name.toLowerCase() === dbItemType.name.toLowerCase(),
          );

          if (!exists) {
            targetSubcategory.itemTypes.push({
              id: dbItemType.id,
              code: dbItemType.code,
              name: dbItemType.name,
            });
          }
        }
      }
    }

    const inactiveRoomKeys = new Set(
      dbRooms
        .filter((room) => !room.active)
        .flatMap((room) => [
          `code:${room.code}`,
          `name:${room.name.toLowerCase()}`,
        ]),
    );

    for (let index = rooms.length - 1; index >= 0; index -= 1) {
      const room = rooms[index];

      if (
        inactiveRoomKeys.has(`code:${room.code}`) ||
        inactiveRoomKeys.has(`name:${room.name.toLowerCase()}`)
      ) {
        rooms.splice(index, 1);
      }
    }

    for (const dbRoom of dbRooms.filter((room) => room.active)) {
      const index = rooms.findIndex(
        (room) =>
          room.code === dbRoom.code ||
          room.name.toLowerCase() === dbRoom.name.toLowerCase(),
      );

      if (index >= 0) {
        rooms[index] = {
          id: dbRoom.id,
          code: dbRoom.code,
          name: dbRoom.name,
        };
      } else {
        rooms.push({
          id: dbRoom.id,
          code: dbRoom.code,
          name: dbRoom.name,
        });
      }
    }

    for (const dbTemplate of dbTemplates.filter((template) => template.active)) {
      const key = `${dbTemplate.type}:${dbTemplate.title.toLowerCase()}`;

      if (inactiveTemplateKeys.has(key)) continue;

      const exists = messageTemplates.some(
        (template) =>
          template.type === dbTemplate.type &&
          template.name.toLowerCase() === dbTemplate.title.toLowerCase(),
      );

      if (!exists) {
        messageTemplates.push({
          id: dbTemplate.id,
          type: dbTemplate.type,
          name: dbTemplate.title,
          description: dbTemplate.body,
        });
      }
    }

    for (const template of MESSAGE_TEMPLATE_MASTER) {
      const key = `${template.type}:${template.name.toLowerCase()}`;
      const exists = messageTemplates.some(
        (existingTemplate) =>
          existingTemplate.type === template.type &&
          existingTemplate.name.toLowerCase() === template.name.toLowerCase(),
      );

      if (!inactiveTemplateKeys.has(key) && !exists) {
        messageTemplates.push({ ...template });
      }
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
