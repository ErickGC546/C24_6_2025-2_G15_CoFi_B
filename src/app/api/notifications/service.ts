import { prisma } from '@/lib/prisma';
import { admin } from '@/lib/firebaseAdmin';

export enum NotificationType {
  BUDGET_EXCEEDED = 'BUDGET_EXCEEDED',
  BUDGET_WARNING = 'BUDGET_WARNING',
  GOAL_ACHIEVED = 'GOAL_ACHIEVED',
  GROUP_CONTRIBUTION = 'GROUP_CONTRIBUTION',
  GROUP_WITHDRAWAL = 'GROUP_WITHDRAWAL',
  MEMBER_JOINED = 'MEMBER_JOINED',
  MEMBER_LEFT = 'MEMBER_LEFT',
}

interface NotificationData {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
}

export class NotificationService {
  
  // Crear notificación en BD y enviar push
  static async createAndSendNotification(notificationData: NotificationData) {
    try {
      // 1. Guardar en base de datos
      const notification = await prisma.notification.create({
        data: {
          userId: notificationData.userId,
          type: notificationData.type,
          title: notificationData.title,
          message: notificationData.message,
          data: notificationData.data || {},
        },
      });

      // 2. Enviar notificación push
      await this.sendPushNotification(
        notificationData.userId,
        notificationData.title,
        notificationData.message,
        notificationData.data
      );

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Enviar notificación push a un usuario
  static async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: any
  ) {
    try {
      // Obtener tokens FCM del usuario
      const userTokens = await prisma.userFCMToken.findMany({
        where: { userId, isActive: true },
        select: { token: true },
      });

      if (userTokens.length === 0) {
        console.log('No FCM tokens found for user:', userId);
        return { successCount: 0 };
      }

      const tokens = userTokens.map((t) => t.token);

      // Configurar el mensaje
      const message = {
        notification: {
          title,
          body,
        },
        data: data || {},
        tokens,
      };

      // Enviar notificación
      const response = await admin.messaging().sendEachForMulticast(message);

      // Limpiar tokens inválidos
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
          }
        });

        if (failedTokens.length > 0) {
          await prisma.userFCMToken.updateMany({
            where: { token: { in: failedTokens } },
            data: { isActive: false },
          });
        }
      }

      return { successCount: response.successCount };
    } catch (error) {
      console.error('Error sending push notification:', error);
      throw error;
    }
  }

  // Notificación de aporte grupal a todos los miembros
  static async notifyGroupContribution(
    groupId: string,
    contributorName: string,
    goalName: string,
    amount: number,
    excludeUserId?: string // Excluir al usuario que hizo el aporte
  ) {
    try {
      // Obtener todos los miembros del grupo
      const groupMembers = await prisma.groupMember.findMany({
        where: {
          groupId,
          userId: excludeUserId ? { not: excludeUserId } : undefined,
        },
        select: { userId: true },
      });

      const title = '💰 Nuevo Aporte';
      const message = `${contributorName} agregó $${amount.toFixed(2)} a "${goalName}"`;

      // Enviar notificación a cada miembro
      const notifications = groupMembers.map(member =>
        this.createAndSendNotification({
          userId: member.userId,
          type: NotificationType.GROUP_CONTRIBUTION,
          title,
          message,
          data: { groupId, goalName, amount, contributorName },
        })
      );

      await Promise.all(notifications);
    } catch (error) {
      console.error('Error notifying group contribution:', error);
      throw error;
    }
  }

  // Notificación de retiro grupal
  static async notifyGroupWithdrawal(
    groupId: string,
    withdrawerName: string,
    goalName: string,
    amount: number,
    excludeUserId?: string
  ) {
    try {
      const groupMembers = await prisma.groupMember.findMany({
        where: {
          groupId,
          userId: excludeUserId ? { not: excludeUserId } : undefined,
        },
        select: { userId: true },
      });

      const title = '📤 Retiro Realizado';
      const message = `${withdrawerName} retiró $${amount.toFixed(2)} de "${goalName}"`;

      const notifications = groupMembers.map((member: { userId: string }) =>
        this.createAndSendNotification({
          userId: member.userId,
          type: NotificationType.GROUP_WITHDRAWAL,
          title,
          message,
          data: { groupId, goalName, amount, withdrawerName },
        })
      );

      await Promise.all(notifications);
    } catch (error) {
      console.error('Error notifying group withdrawal:', error);
      throw error;
    }
  }



  // Notificación de presupuesto excedido
  static async notifyBudgetExceeded(
    userId: string,
    categoryName: string,
    budgetAmount: number,
    currentSpent: number
  ) {
    try {
      const percentage = ((currentSpent / budgetAmount) * 100).toFixed(0);
      const title = '⚠️ Presupuesto Excedido';
      const message = `Has excedido el presupuesto de "${categoryName}" en un ${percentage}%`;

      await this.createAndSendNotification({
        userId,
        type: NotificationType.BUDGET_EXCEEDED,
        title,
        message,
        data: { categoryName, budgetAmount, currentSpent, percentage },
      });
    } catch (error) {
      console.error('Error notifying budget exceeded:', error);
      throw error;
    }
  }

  // Notificación de advertencia de presupuesto (80%)
  static async notifyBudgetWarning(
    userId: string,
    categoryName: string,
    budgetAmount: number,
    currentSpent: number
  ) {
    try {
      const percentage = ((currentSpent / budgetAmount) * 100).toFixed(0);
      const title = '💡 Alerta de Presupuesto';
      const message = `Estás cerca del límite de "${categoryName}" (${percentage}%)`;
      await this.createAndSendNotification({
        userId,
        type: NotificationType.BUDGET_WARNING,
        title,
        message,
        data: { categoryName, budgetAmount, currentSpent, percentage },
      });
    } catch (error) {
      console.error('Error notifying budget warning:', error);
      throw error;
    }
  }

  // Notificación de meta alcanzada
  static async notifyGoalAchieved(
    userId: string,
    goalName: string,
    targetAmount: number
  ) {
    try {
      const title = '🎉 ¡Meta Alcanzada!';
      const message = `¡Felicidades! Has alcanzado tu meta de "${goalName}" ($${targetAmount.toFixed(2)})`;

      await this.createAndSendNotification({
        userId,
        type: NotificationType.GOAL_ACHIEVED,
        title,
        message,
        data: { goalName, targetAmount },
      });
    } catch (error) {
      console.error('Error notifying goal achieved:', error);
      throw error;
    }
  }

  // Notificación de nuevo miembro en grupo
  static async notifyMemberJoined(
    groupId: string,
    memberName: string,
    groupName: string,
    excludeUserId?: string
  ) {
    try {
      const groupMembers = await prisma.groupMember.findMany({
        where: {
          groupId,
          userId: excludeUserId ? { not: excludeUserId } : undefined,
        },
        select: { userId: true },
      });

      const title = '👋 Nuevo Miembro';
      const message = `${memberName} se unió al grupo "${groupName}"`;

      const notifications = groupMembers.map((member: { userId: string }) =>
        this.createAndSendNotification({
          userId: member.userId,
          type: NotificationType.MEMBER_JOINED,
          title,
          message,
          data: { groupId, groupName, memberName },
        })
      );

      await Promise.all(notifications);
    } catch (error) {
      console.error('Error notifying member joined:', error);
      throw error;
    }
  }

  // Notificación de miembro que dejó el grupo
  static async notifyMemberLeft(
    groupId: string,
    memberName: string,
    groupName: string,
    excludeUserId?: string
  ) {
    try {
      const groupMembers = await prisma.groupMember.findMany({
        where: {
          groupId,
          userId: excludeUserId ? { not: excludeUserId } : undefined,
        },
        select: { userId: true },
      });

      const title = '👋 Miembro Salió';
      const message = `${memberName} salió del grupo "${groupName}"`;

      const notifications = groupMembers.map((member: { userId: string }) =>
        this.createAndSendNotification({
          userId: member.userId,
          type: NotificationType.MEMBER_LEFT,
          title,
          message,
          data: { groupId, groupName, memberName },
        })
      );

      await Promise.all(notifications);
    } catch (error) {
      console.error('Error notifying member left:', error);
      throw error;
    }
  }

}