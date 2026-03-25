
import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import { Resend } from 'npm:resend';

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
        if (!job || !job.podNotes) {
            return Response.json({ error: 'Job or POD notes not found' }, { status: 404 });
        }

        // Get all dispatcher and admin users
        const allUsers = await base44.asServiceRole.entities.User.list();
        const dispatcherEmails = allUsers
            .filter(u => u.role === 'admin' || u.appRole === 'dispatcher')
            .map(u => u.email)
            .filter(email => email);

        if (dispatcherEmails.length === 0) {
            return Response.json({ error: 'No dispatchers found' }, { status: 404 });
        }

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #f59e0b; color: white; padding: 20px; text-align: center; }
                    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
                    .notes-box { margin: 15px 0; padding: 15px; background-color: #fef3c7; border: 2px solid #fbbf24; border-radius: 8px; }
                    .detail-row { margin: 10px 0; padding: 10px; background-color: white; border-radius: 4px; }
                    .label { font-weight: bold; color: #4b5563; }
                    .value { color: #111827; }
                    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
                    .warning-badge { display: inline-block; padding: 8px 16px; background-color: #fef3c7; color: #92400e; border-radius: 20px; font-weight: bold; margin: 10px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>⚠️ Delivery Notes Submitted</h1>
                    </div>
                    <div class="content">
                        <p><span class="warning-badge">Requires Review</span></p>
                        <p>A driver has submitted notes about a delivery that may require attention.</p>
                        
                        <div class="detail-row">
                            <span class="label">Customer:</span>
                            <span class="value">${job.customerName}</span>
                        </div>
                        
                        <div class="detail-row">
                            <span class="label">Delivery Location:</span>
                            <span class="value">${job.deliveryLocation}</span>
                        </div>
                        
                        <div class="notes-box">
                            <h3 style="margin: 0 0 10px 0; color: #92400e;">Driver's Notes:</h3>
                            <p style="margin: 0; white-space: pre-wrap;">${job.podNotes}</p>
                        </div>
                        
                        <div class="detail-row">
                            <span class="label">Submitted By:</span>
                            <span class="value">${job.updated_by || 'Driver'}</span>
                        </div>
                        
                        <p style="margin-top: 20px; padding: 15px; background-color: #fee2e2; border-radius: 4px; border-left: 4px solid #dc2626;">
                            <strong>Action Required:</strong> Please review these notes and take appropriate action. This may require follow-up with the customer or additional scheduling.
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
            to: dispatcherEmails,
            subject: `Delivery Notes Require Review - ${job.customerName}`,
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
