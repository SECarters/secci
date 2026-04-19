import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import { Resend } from 'npm:resend@4.0.0';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { jobId, customerEmail, customerName, truckName, date, timeSlot } = body;

        if (!jobId || !customerEmail || !customerName) {
            return Response.json({ 
                error: 'Missing required fields: jobId, customerEmail, customerName' 
            }, { status: 400 });
        }

        const job = await base44.asServiceRole.entities.Job.get(jobId);
        if (!job) {
            return Response.json({ error: 'Job not found' }, { status: 404 });
        }

        const formattedDate = new Date(date).toLocaleDateString('en-AU', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const timeSlotLabels = {
            'first-am': '6-8am (1st AM)',
            'second-am': '8-10am (2nd AM)',
            'lunch': '10am-12pm (LUNCH)',
            'first-pm': '12-2pm (1st PM)',
            'second-pm': '2-4pm (2nd PM)'
        };

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
                    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
                    .detail-row { margin: 10px 0; padding: 10px; background-color: white; border-radius: 4px; }
                    .label { font-weight: bold; color: #4b5563; }
                    .value { color: #111827; }
                    .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Delivery Scheduled</h1>
                    </div>
                    <div class="content">
                        <p>Hi ${customerName},</p>
                        <p>Your delivery has been scheduled. Here are the details:</p>
                        
                        <div class="detail-row">
                            <span class="label">Truck:</span>
                            <span class="value">${truckName}</span>
                        </div>
                        
                        <div class="detail-row">
                            <span class="label">Date:</span>
                            <span class="value">${formattedDate}</span>
                        </div>
                        
                        <div class="detail-row">
                            <span class="label">Time Window:</span>
                            <span class="value">${timeSlotLabels[timeSlot] || timeSlot}</span>
                        </div>
                        
                        <div class="detail-row">
                            <span class="label">Delivery Location:</span>
                            <span class="value">${job.deliveryLocation}</span>
                        </div>
                        
                        <div class="detail-row">
                            <span class="label">Site Contact:</span>
                            <span class="value">${job.siteContactName || 'N/A'} - ${job.siteContactPhone || 'N/A'}</span>
                        </div>
                        
                        <p style="margin-top: 20px;">Please note: Delivery times may change due to operational factors. We’ll notify you promptly if adjustments are required. Thank you for choosing South East Carters — we appreciate your business.</p>
                    </div>
                    <div class="footer">
                        <p>Notice: All bookings are subject to availability and may be rescheduled or cancelled without prior notice. South East Carters accepts no liability for delays or damages arising from circumstances beyond our control. Additional fees may apply where extra time, resources, or special handling are required to complete the delivery.</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        const { data, error } = await resend.emails.send({
            from: 'SECCI <scheduling@secci.info>',
            to: [customerEmail],
            subject: `Delivery Scheduled - ${formattedDate}`,
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