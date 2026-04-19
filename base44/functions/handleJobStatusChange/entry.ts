import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin' && !['dispatcher', 'driver'].includes(user.appRole)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { jobId, oldStatus, newStatus } = await req.json();

    if (!jobId || !newStatus) {
      return Response.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const jobData = await base44.asServiceRole.entities.Job.get(jobId);
    if (!jobData) {
      return Response.json({ error: 'Job not found' }, { status: 404 });
    }

    const dispatchers = await base44.asServiceRole.entities.User.filter({ appRole: 'dispatcher' });
    const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
    const notificationsToCreate = [];

    for (const u of [...dispatchers, ...admins]) {
      notificationsToCreate.push({
        userId: u.id,
        jobId,
        title: 'Job Status Updated',
        message: `Job for ${jobData.customerName} at ${jobData.deliveryLocation} is now ${newStatus.replace(/_/g, ' ')}`,
        type: 'job_status_update',
        isRead: false,
        context: { oldStatus, newStatus, customerName: jobData.customerName, deliveryLocation: jobData.deliveryLocation }
      });
    }

    if (newStatus === 'DELIVERED' || newStatus === 'CANCELLED') {
      const customerUsers = await base44.asServiceRole.entities.User.filter({ customerId: jobData.customerId });

      for (const customerUser of customerUsers) {
        notificationsToCreate.push({
          userId: customerUser.id,
          jobId,
          title: newStatus === 'DELIVERED' ? 'Delivery Completed' : 'Job Cancelled',
          message: `Your delivery to ${jobData.deliveryLocation} has been ${newStatus.toLowerCase()}`,
          type: 'job_status_update',
          isRead: false,
          context: { oldStatus, newStatus, customerName: jobData.customerName, deliveryLocation: jobData.deliveryLocation }
        });
      }

      // Send delivery-completed email via dedicated function
      if (newStatus === 'DELIVERED') {
        try {
          await base44.asServiceRole.functions.invoke('sendDeliveryCompletedEmail', { jobId });
        } catch (e) {
          console.error('Failed to send delivery completed email:', e);
        }
      }

      // Send cancellation email inline
      if (newStatus === 'CANCELLED') {
        try {
          const customer = await base44.asServiceRole.entities.Customer.get(jobData.customerId);
          if (customer?.contactEmail) {
            await base44.asServiceRole.integrations.Core.SendEmail({
              to: customer.contactEmail,
              subject: `Job Cancelled - ${jobData.customerName}`,
              body: `Your delivery to ${jobData.deliveryLocation} has been cancelled.\n\nPlease contact us if you have any questions.`
            });
          }
        } catch (e) {
          console.error('Failed to send cancellation email:', e);
        }
      }
    }

    if (notificationsToCreate.length > 0) {
      await base44.asServiceRole.entities.Notification.bulkCreate(notificationsToCreate);
    }

    return Response.json({ success: true, notificationsCreated: notificationsToCreate.length });

  } catch (error) {
    console.error('Error handling job status change:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});