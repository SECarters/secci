import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { fileUrl } = await req.json();

        if (!fileUrl) {
            return Response.json({ success: false, error: 'fileUrl is required' }, { status: 400 });
        }

        if (!fileUrl.startsWith('https://')) {
            return Response.json({ success: false, error: 'Invalid file URL' }, { status: 400 });
        }

        const json_schema = {
            type: "object",
            properties: {
                customer_name: { type: "string" },
                customer_reference: { type: "string" },
                delivery_address: { type: "string" },
                order_number: { type: "string" },
                supplier_name: { type: "string" },
                shipping_date: { type: "string" },
                site_contact: { type: "string" },
                site_contact_phone: { type: "string" },
                total_m2: { type: "number" },
                total_weight: { type: "number" },
                total_sheets: { type: "number" },
                delivery_notes: { type: "string" },
                line_items: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            product_code: { type: "string" },
                            product_description: { type: "string" },
                            quantity: { type: "number" },
                            unit: { type: "string" },
                            m2: { type: "number" },
                            weight: { type: "number" }
                        }
                    }
                }
            }
        };

        const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
            file_url: fileUrl,
            json_schema
        });

        if (result.status !== 'success' || !result.output) {
            return Response.json({
                success: false,
                error: result.details || 'Failed to extract data from document'
            }, { status: 422 });
        }

        return Response.json({ success: true, data: result.output });

    } catch (error) {
        console.error('Document extraction error:', error);
        return Response.json({ success: false, error: 'Failed to extract data from document' }, { status: 500 });
    }
});