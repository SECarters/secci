import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verify user is authenticated
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { fileUrl, fileName, fileType } = body;

        if (!fileUrl) {
            return Response.json({ error: 'fileUrl is required' }, { status: 400 });
        }

        // Generate unique session ID
        const sessionId = `extraction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Send to Zapier webhook
        const zapierWebhookUrl = Deno.env.get('ZAPIER_WEBHOOK_URL');
        
        if (!zapierWebhookUrl) {
            return Response.json({ 
                error: 'Zapier webhook URL not configured' 
            }, { status: 500 });
        }

        const zapierPayload = {
            eventType: 'document_uploaded_for_extraction',
            timestamp: new Date().toISOString(),
            triggeredBy: {
                email: user.email,
                name: user.full_name,
                role: user.appRole
            },
            data: {
                fileUrl,
                fileName,
                fileType,
                sessionId,
                expectedFields: {
                    customerName: 'string',
                    deliveryLocation: 'string (full address)',
                    poSalesDocketNumber: 'string',
                    totalUnits: 'number',
                    sqm: 'number (square meters)',
                    weightKg: 'number (kilograms)',
                    siteContactName: 'string',
                    siteContactPhone: 'string',
                    requestedDate: 'date (YYYY-MM-DD)',
                    deliveryNotes: 'string',
                    pickupLocation: 'string (supplier name)'
                }
            }
        };

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
            sessionId,
            message: 'Document sent to Zapier for processing'
        });

    } catch (error) {
        console.error('Zapier extraction request error:', error);
        return Response.json({ 
            error: 'Failed to request Zapier extraction',
            details: error.message 
        }, { status: 500 });
    }
});