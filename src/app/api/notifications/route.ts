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

// GET /api/notifications - Obtener notificaciones del usuario
export async function GET(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    // Obtener contador de no leídas
    if (action === 'unread-count') {
      const count = await prisma.notification.count({
        where: { 
          userId: user.uid,
          isRead: false,
        },
      });

      return NextResponse.json({
        success: true,
        count,
      });
    }

    // Obtener lista de notificaciones
    const limit = parseInt(searchParams.get('limit') || '20');
    const notifications = await prisma.notification.findMany({
      where: { userId: user.uid },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      notifications,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { success: false, message: 'Error fetching notifications', error },
      { status: 500 }
    );
  }
}

// POST /api/notifications - Guardar token FCM o marcar todas como leídas
export async function POST(req: NextRequest) {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { action, token, platform, deviceId } = body;

    // Guardar token FCM
    if (action === 'save-token' && token) {
      const userToken = await prisma.userFCMToken.upsert({
        where: { token },
        create: {
          userId: user.uid,
          token,
          platform: platform || 'unknown',
          deviceId,
        },
        update: {
          userId: user.uid,
          platform: platform || 'unknown',
          deviceId,
          isActive: true,
          updatedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Token saved successfully',
        token: userToken,
      });
    }

    // Marcar todas como leídas
    if (action === 'mark-all-read') {
      const result = await prisma.notification.updateMany({
        where: { 
          userId: user.uid,
          isRead: false,
        },
        data: { 
          isRead: true,
          readAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: 'All notifications marked as read',
        count: result.count,
      });
    }

    return NextResponse.json(
      { success: false, message: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error in POST notifications:', error);
    return NextResponse.json(
      { success: false, message: 'Error processing request', error },
      { status: 500 }
    );
  }
}