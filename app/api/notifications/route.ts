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

    const notifications = await prisma.notification.findMany({
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
    });

    return NextResponse.json({
      notifications: notifications.map((notification) => ({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        readAt: notification.readAt,
        createdAt: notification.createdAt,
        reportId: notification.reportId,
        ticket: notification.report
          ? formatTicketFallback(notification.report)
          : null,
      })),
      unreadCount: notifications.filter((notification) => !notification.readAt).length,
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

    await req.json().catch(() => ({}));
    await prisma.notification.updateMany({
      where: {
        userId: authUser.id,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return NextResponse.json({ message: "Notifikasi ditandai sudah dibaca." });
  } catch (error) {
    console.error("READ_NOTIFICATIONS_ERROR:", error);

    return NextResponse.json(
      { message: "Gagal memperbarui notifikasi." },
      { status: 500 },
    );
  }
}
