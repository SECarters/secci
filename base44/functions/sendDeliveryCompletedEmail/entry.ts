import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@4.0.0';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

const esc = (s) => s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') : '';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (user.role !== 'admin' && !['dispatcher', 'driver', 'manager'].includes(user.appRole)) {
            return Response.json({ error: 'Forbidden' }, { status: 403 });
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

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #10b981; color: white; padding: 20px; text-align: center; }
                    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
                    .detail-row { margin: 10px 0; padding: 10px; background-color: white; border-radius: 4px; }
                    .label { font-weight: bold; color: #4b5563; }
                    .value { color: #111827; }
                    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
                    .success-badge { display: inline-block; padding: 8px 16px; background-color: #d1fae5; color: #065f46; border-radius: 20px; font-weight: bold; margin: 10px 0; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>&#10003; Delivery Completed</h1>
                    </div>
                    <div class="content">
                        <p>Hi ${esc(customer.customerName)},</p>
                        <p><span class="success-badge">Delivery Complete</span></p>
                        <p>Your delivery has been successfully completed, and proof of delivery photos are available for viewing on SECCI. Here are the details:</p>
                        
                        <div class="detail-row">
                            <span class="label">Delivery Location:</span>
                            <span class="value">${esc(job.deliveryLocation)}</span>
                        </div>
                        
                        <div class="detail-row">
                            <span class="label">Completed:</span>
                            <span class="value">${new Date().toLocaleString('en-AU')}</span>
                        </div>
                        
                        ${job.podNotes ? `
                        <div class="detail-row">
                            <span class="label">Delivery Notes:</span>
                            <span class="value">${esc(job.podNotes)}</span>
                        </div>
                        ` : ''}
                        
                        <p style="margin-top: 20px;">Thank you for choosing South East Carters.</p>
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
            to: [customer.contactEmail],
            subject: 'Delivery Completed - SECCI',
            html: htmlContent,
        });

        if (error) {
            console.error('Resend API error:', error);
            return Response.json({ error: 'Failed to send email' }, { status: 500 });
        }

        return Response.json({ success: true, messageId: data.id });
    } catch (error) {
        console.error('Error sending email:', error);
        return Response.json({ error: 'Failed to send email' }, { status: 500 });
    }
});