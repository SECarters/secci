import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verify user is authenticated
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const zapierWebhookUrl = Deno.env.get('ZAPIER_WEBHOOK_URL');
        
        if (!zapierWebhookUrl) {
            return Response.json({ 
                error: 'Zapier webhook URL not configured' 
            }, { status: 500 });
        }

        const body = await req.json();
        const { eventType, data } = body;

        if (!eventType || !data) {
            return Response.json({ 
                error: 'Missing required fields: eventType and data' 
            }, { status: 400 });
        }

        // Prepare payload for Zapier
        const zapierPayload = {
            eventType,
            timestamp: new Date().toISOString(),
            triggeredBy: {
                email: user.email,
                name: user.full_name,
                role: user.appRole
            },
            data
        };

        // Send to Zapier webhook
        const zapierResponse = await fetch(zapierWebhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(zapierPayload)
        });

        if (!zapierResponse.ok) {
            console.error('Zapier webhook failed:', zapierResponse.status);
            return Response.json({ 
                error: 'Failed to send to Zapier',
                status: zapierResponse.status
            }, { status: 500 });
        }

        return Response.json({ 
            success: true,
            message: 'Event sent to Zapier successfully'
        });

    } catch (error) {
        console.error('Zapier integration error:', error);
        return Response.json({ 
            error: 'Failed to process Zapier webhook',
            details: error.message 
        }, { status: 500 });
    }
});