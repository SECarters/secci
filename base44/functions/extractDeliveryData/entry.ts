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
                customer_name: { type: "string", description: "Name of the customer or recipient" },
                customer_reference: { type: "string", description: "Customer PO or reference number" },
                delivery_address: { type: "string", description: "Full delivery address" },
                order_number: { type: "string", description: "Order or docket number" },
                supplier_name: { type: "string", description: "Supplier or manufacturer name" },
                shipping_date: { type: "string", description: "Requested delivery or shipping date (ISO format if possible)" },
                site_contact: { type: "string", description: "Site contact person name" },
                site_contact_phone: { type: "string", description: "Site contact phone number" },
                total_m2: { type: "number", description: "Total square metres across all line items" },
                total_weight: { type: "number", description: "Total weight in kilograms. Look for a 'Weight' column total or footer row. If not present, sum the weight column values from all line items." },
                total_sheets: { type: "number", description: "Total number of sheets/boards/pieces across all line items" },
                delivery_notes: { type: "string", description: "Any delivery instructions or notes" },
                line_items: {
                    type: "array",
                    description: "Extract EVERY row from the sheet list table, including section subheadings and table breaks (e.g. 'FIRST FLOOR - MANITOU', 'GROUND FLOOR - HAND UNLOAD'). These section headers must be included as their own entries with the subheading text as the product_description and no quantity/weight. Do NOT skip any rows.",
                    items: {
                        type: "object",
                        properties: {
                            product_code: { type: "string", description: "Product code or SKU. Leave blank for section header rows." },
                            product_description: { type: "string", description: "Full product description including dimensions and type (e.g. '2400x1200x10mm Std White Board'). For section header/subheading rows, use the full subheading text (e.g. 'FIRST FLOOR - MANITOU')." },
                            quantity: { type: "number", description: "Number of units/sheets for this line item. Omit for section header rows." },
                            unit: { type: "string", description: "Unit of measure (e.g. 'Sheet', 'Pcs', 'Lm'). Omit for section header rows." },
                            m2: { type: "number", description: "Square metres for this line item. Calculate as quantity × m2_per_unit if not shown directly. Omit for section header rows." },
                            weight: { type: "number", description: "Weight in kilograms for this line item. Extract directly from the 'Weight' column. This is the TOTAL weight for the row (already multiplied by quantity). Do NOT leave blank for product rows — if a Weight column exists, every product row must have a value. Omit for section header rows." }
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

        const output = result.output;

        // If total_weight is missing but line items have weights, sum them
        if (!output.total_weight && output.line_items?.length > 0) {
            const summedWeight = output.line_items.reduce((sum, item) => sum + (item.weight || 0), 0);
            if (summedWeight > 0) output.total_weight = summedWeight;
        }

        return Response.json({ success: true, data: output });

    } catch (error) {
        console.error('Document extraction error:', error);
        return Response.json({ success: false, error: 'Failed to extract data from document' }, { status: 500 });
    }
});