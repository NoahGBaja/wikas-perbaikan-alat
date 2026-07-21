import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";
import { getApiSessionUser } from "@/src/lib/session";
import { validateMutationRequest } from "@/src/lib/request-security";
import { formatTicketFallback } from "@/src/lib/tickets";

export async function GET() {
  try {
    const authUser = await getApiSessionUser();

    if (!authUser) {
      return NextResponse.json({ message: "Sesi masuk tidak ditemukan." }, { status: 401 });
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: {
          userId: authUser.id,
        },
        include: {
          report: {
            select: {
              id: true,
              ticket: true,
              kategori: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
      }),
      prisma.notification.count({
        where: {
          userId: authUser.id,
          readAt: null,
        },
      }),
    ]);

    return NextResponse.json({
      notifications: notifications.map((notification) => ({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
        reportId: notification.reportId,
        href: notification.reportId
          ? authUser.role === "USER"
            ? `/dashboard/user/status?report=${notification.reportId}`
            : `/dashboard/admin?report=${notification.reportId}`
          : null,
        ticket: notification.report
          ? formatTicketFallback(notification.report)
          : null,
      })),
      unreadCount,
    });
  } catch (error) {
    console.error("GET_NOTIFICATIONS_ERROR:", error);

    return NextResponse.json(
      { message: "Gagal memuat notifikasi." },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const requestError = validateMutationRequest(req, { body: "json" });

    if (requestError) return requestError;

    const authUser = await getApiSessionUser();

    if (!authUser) {
      return NextResponse.json({ message: "Sesi masuk tidak ditemukan." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    if (body.readAll === true) {
      const result = await prisma.notification.updateMany({
        where: {
          userId: authUser.id,
          readAt: null,
        },
        data: {
          readAt: new Date(),
        },
      });

      return NextResponse.json({
        message: "Semua notifikasi ditandai sudah dibaca.",
        updatedCount: result.count,
      });
    }

    const notificationId = Number(body.notificationId);

    if (!Number.isInteger(notificationId) || notificationId <= 0) {
      return NextResponse.json(
        { message: "Notifikasi tidak valid." },
        { status: 400 },
      );
    }

    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        userId: authUser.id,
      },
      select: { id: true },
    });

    if (!notification) {
      return NextResponse.json(
        { message: "Notifikasi tidak ditemukan." },
        { status: 404 },
      );
    }

    await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId: authUser.id,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      message: "Notifikasi ditandai sudah dibaca.",
      notificationId,
    });
  } catch (error) {
    console.error("READ_NOTIFICATIONS_ERROR:", error);

    return NextResponse.json(
      { message: "Gagal memperbarui notifikasi." },
      { status: 500 },
    );
  }
}
