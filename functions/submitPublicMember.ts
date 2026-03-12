import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const body = await req.json();

        const {
            first_name, last_name, other_names, email, phone,
            address, city, postcode, date_of_birth, gender,
            marital_status, how_heard, salvation_date, notes
        } = body;

        if (!first_name || !last_name) {
            return Response.json({ error: 'First name and last name are required.' }, { status: 400 });
        }

        const memberData = {
            first_name,
            last_name,
            ...(other_names && { other_names }),
            ...(email && { email }),
            ...(phone && { phone }),
            ...(address && { address }),
            ...(city && { city }),
            ...(postcode && { postcode }),
            ...(date_of_birth && { date_of_birth }),
            ...(gender && { gender }),
            ...(marital_status && { marital_status }),
            ...(salvation_date && { salvation_date }),
            ...(notes && { notes }),
            membership_status: 'First Timer',
            join_date: new Date().toISOString().split('T')[0],
        };

        const member = await base44.asServiceRole.entities.Member.create(memberData);

        // Also create a first-timer record
        await base44.asServiceRole.entities.FirstTimer.create({
            first_name,
            last_name,
            email: email || '',
            phone: phone || '',
            address: address || '',
            gender: gender || '',
            visit_date: new Date().toISOString().split('T')[0],
            how_heard: how_heard || 'Other',
            status: 'New',
        });

        return Response.json({ success: true, member_id: member.id });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});