import { NextRequest, NextResponse } from 'next/server';
import { admin } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

// Verificar autenticación
async function verifyAuth(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.substring(7);
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

// PATCH /api/notifications/[id] - Marcar notificación como leída
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const notificationId = id;

    const notification = await prisma.notification.update({
      where: { 
        id: notificationId,
        userId: user.uid,
      },
      data: { 
        isRead: true,
        readAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      notification,
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return NextResponse.json(
      { success: false, message: 'Error marking notification as read', error },
      { status: 500 }
    );
  }
}

// DELETE /api/notifications/[id] - Eliminar notificación
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const notificationId = id;

    await prisma.notification.delete({
      where: { 
        id: notificationId,
        userId: user.uid,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json(
      { success: false, message: 'Error deleting notification', error },
      { status: 500 }
    );
  }
}
