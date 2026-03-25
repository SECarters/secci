
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
        const { jobId, recipientEmail, recipientName } = body;

        if (!jobId || !recipientEmail || !recipientName) {
            return Response.json({ 
                error: 'Missing required fields: jobId, recipientEmail, recipientName' 
            }, { status: 400 });
        }

        const job = await base44.asServiceRole.entities.Job.get(jobId);
        if (!job) {
            return Response.json({ error: 'Job not found' }, { status: 404 });
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
                        <h1>✓ Job Created Successfully</h1>
                    </div>
                    <div class="content">
                        <p>Hi ${recipientName},</p>
                        <p><span class="success-badge">Job Submitted</span></p>
                        <p>Thank you for submitting the below delivery request with South East Carters. Our team will review the details and confirm availability shortly.</p>
                        
                        <div class="detail-row">
                            <span class="label">Customer:</span>
                            <span class="value">${job.customerName}</span>
                        </div>
                        
                        <div class="detail-row">
                            <span class="label">Delivery Type:</span>
                            <span class="value">${job.deliveryTypeName}</span>
                        </div>
                        
                        <div class="detail-row">
                            <span class="label">Delivery Location:</span>
                            <span class="value">${job.deliveryLocation}</span>
                        </div>
                        
                        <div class="detail-row">
                            <span class="label">Requested Date:</span>
                            <span class="value">${formattedDate}</span>
                        </div>
                        
                        ${job.deliveryWindow ? `
                        <div class="detail-row">
                            <span class="label">Preferred Window:</span>
                            <span class="value">${job.deliveryWindow}</span>
                        </div>
                        ` : ''}
                        
                        <p style="margin-top: 20px;">Please note: This email is an acknowledgment only — bookings are subject to confirmation and availability, and may be rescheduled or cancelled if required. We appreciate your patience and understanding, and we’ll be in touch soon with your confirmed booking details.</p>
                    </div>
                    <div class="footer">
                        <p>All bookings are subject to availability and may be rescheduled or cancelled without prior notice. South East Carters accepts no liability for delays or damages arising from circumstances beyond our control. Additional fees may apply where extra time, resources, or special handling are required to complete the delivery.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const { data, error } = await resend.emails.send({
            from: 'SECCI <noreply@secci.info>',
            to: [recipientEmail],
            subject: 'Delivery Job Request Received',
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
