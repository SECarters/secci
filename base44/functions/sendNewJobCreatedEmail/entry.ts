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
        if (user.role !== 'admin' && !['dispatcher', 'driver', 'manager', 'customer'].includes(user.appRole)) {
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

        const allUsers = await base44.asServiceRole.entities.User.filter({ appRole: 'dispatcher' });
        const adminUsers = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
        const dispatcherEmails = [...allUsers, ...adminUsers]
            .map(u => u.email)
            .filter(email => email);

        if (dispatcherEmails.length === 0) {
            return Response.json({ error: 'No dispatchers found' }, { status: 404 });
        }

        const formattedDate = new Date(job.requestedDate).toLocaleDateString('en-AU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #3b82f6; color: white; padding: 20px; text-align: center; }
                    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
                    .detail-row { margin: 10px 0; padding: 10px; background-color: white; border-radius: 4px; }
                    .label { font-weight: bold; color: #4b5563; }
                    .value { color: #111827; }
                    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
                    .badge { display: inline-block; padding: 4px 12px; background-color: #dbeafe; color: #1e40af; border-radius: 12px; font-size: 12px; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>&#128276; New Job Created</h1>
                    </div>
                    <div class="content">
                        <p><span class="badge">${esc(job.status.replace(/_/g, ' '))}</span></p>
                        <p>A new delivery job has been created and requires scheduling.</p>
                        
                        <div class="detail-row">
                            <span class="label">Customer:</span>
                            <span class="value">${esc(job.customerName)}</span>
                        </div>
                        
                        <div class="detail-row">
                            <span class="label">Delivery Type:</span>
                            <span class="value">${esc(job.deliveryTypeName)}</span>
                        </div>
                        
                        <div class="detail-row">
                            <span class="label">Location:</span>
                            <span class="value">${esc(job.deliveryLocation)}</span>
                        </div>
                        
                        <div class="detail-row">
                            <span class="label">Requested Date:</span>
                            <span class="value">${esc(formattedDate)}</span>
                        </div>
                        
                        ${job.deliveryWindow ? `
                        <div class="detail-row">
                            <span class="label">Preferred Window:</span>
                            <span class="value">${esc(job.deliveryWindow)}</span>
                        </div>
                        ` : ''}
                        
                        ${job.sqm ? `
                        <div class="detail-row">
                            <span class="label">Size:</span>
                            <span class="value">${esc(String(job.sqm))}m&#178;</span>
                        </div>
                        ` : ''}
                        
                        <p style="margin-top: 20px; padding: 15px; background-color: #fef3c7; border-radius: 4px; border-left: 4px solid #f59e0b;">
                            <strong>Action Required:</strong> Please review and schedule this job in the delivery portal.
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
            subject: `New Delivery Job - ${esc(job.customerName)} - ${formattedDate}`,
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