
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import { Resend } from 'npm:resend'; // Changed from 'import Resend from ...'

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { jobId } = body;

        if (!jobId) {
            return Response.json({ error: 'Missing jobId' }, { status: 400 });
        }

        const job = await base44.asServiceRole.entities.Job.get(jobId);
        if (!job) {
            return Response.json({ error: 'Job not found' }, { status: 404 });
        }

        const customer = await base44.asServiceRole.entities.Customer.get(job.customerId);
        if (!customer || !customer.contactEmail) {
            return Response.json({ error: 'Customer email not found' }, { status: 404 });
        }

        // Also notify dispatchers
        const allUsers = await base44.asServiceRole.entities.User.list();
        const dispatcherEmails = allUsers
            .filter(u => u.role === 'admin' || u.appRole === 'dispatcher')
            .map(u => u.email)
            .filter(email => email);

        const allRecipients = [customer.contactEmail, ...dispatcherEmails];

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; }
                    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
                    .detail-row { margin: 10px 0; padding: 10px; background-color: white; border-radius: 4px; }
                    .label { font-weight: bold; color: #4b5563; }
                    .value { color: #111827; }
                    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
                    .warning-badge { display: inline-block; padding: 8px 16px; background-color: #fee2e2; color: #991b1b; border-radius: 20px; font-weight: bold; margin: 10px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>⚠️ Delivery Returned</h1>
                    </div>
                    <div class="content">
                        <p>Hi ${customer.customerName},</p>
                        <p><span class="warning-badge">Delivery Returned to Supplier</span></p>
                        <p>Unfortunately, your delivery could not be completed and has been returned to the supplier.</p>
                        
                        <div class="detail-row">
                            <span class="label">Delivery Location:</span>
                            <span class="value">${job.deliveryLocation}</span>
                        </div>
                        
                        <div class="detail-row">
                            <span class="label">Return Reason:</span>
                            <span class="value">${job.returnReason || 'Not specified'}</span>
                        </div>
                        
                        ${job.returnNotes ? `
                        <div class="detail-row">
                            <span class="label">Additional Details:</span>
                            <span class="value">${job.returnNotes}</span>
                        </div>
                        ` : ''}
                        
                        <div class="detail-row">
                            <span class="label">Returned By:</span>
                            <span class="value">${job.returnedBy || 'Driver'}</span>
                        </div>
                        
                        <p style="margin-top: 20px; padding: 15px; background-color: #fef3c7; border-radius: 4px; border-left: 4px solid #f59e0b;">
                            <strong>Next Steps:</strong> Please contact us to arrange a new delivery after addressing the issues mentioned above.
                        </p>
                    </div>
                    <div class="footer">
                        <p>This is an automated message from SECCI Delivery Portal.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const { data, error } = await resend.emails.send({
            from: 'SECCI <noreply@secci.info>',
            to: allRecipients,
            subject: `Delivery Returned - ${job.customerName} - Action Required`,
            html: htmlContent,
        });

        if (error) {
            console.error('Resend API error:', data);
            return Response.json({ error: 'Failed to send email', details: error }, { status: 500 });
        }

        return Response.json({ success: true, messageId: data.id });
    } catch (error) {
        console.error('Error sending email:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});
