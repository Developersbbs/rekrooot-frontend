import { NextResponse } from 'next/server';
import { addDays, format, startOfDay, parseISO, eachHourOfInterval, addHours } from 'date-fns';

export async function POST(req) {
    try {
        const { interviewerId } = await req.json();
        const authHeader = req.headers.get('authorization');

        if (!interviewerId) {
            return NextResponse.json({ message: 'Interviewer ID is required' }, { status: 400 });
        }

        const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5001';

        // Get availability for the next 30 days
        const today = new Date();
        const from = startOfDay(today).toISOString(); // Start from today
        const to = startOfDay(addDays(today, 31)).toISOString(); // Up to 30 days from now

        const response = await fetch(`${backendUrl}/interviewers/${interviewerId}/availability?from=${from}&to=${to}`, {
            method: 'GET',
            headers: {
                'Authorization': authHeader || '',
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            return NextResponse.json({ message: errorData.message || 'Failed to fetch availability' }, { status: response.status });
        }

        const data = await response.json();
        const availabilityRanges = data.availability || [];

        // Process ranges into 1-hour slots
        const timeSlots = [];

        for (const range of availabilityRanges) {
            const start = new Date(range.start_time);
            const end = new Date(range.end_time);

            // Create intervals of 1 hour within the range
            // Ensure the slot fits within the range (start + 1 hour <= end)
            let currentGeneric = start;
            while (addHours(currentGeneric, 1) <= end) {
                // Filter out past slots
                if (currentGeneric <= today) {
                    currentGeneric = addHours(currentGeneric, 1);
                    continue;
                }

                // Format the slot
                const slotDate = format(currentGeneric, 'MMM dd, yyyy');
                const slotTime12 = format(currentGeneric, 'hh:mm a');
                const slotTime24 = format(currentGeneric, 'HH:mm');

                timeSlots.push({
                    date: slotDate,
                    time: slotTime12,
                    time24: slotTime24,
                    duration: '1 hour',
                    iso: currentGeneric.toISOString()
                });

                // Move to next hour
                currentGeneric = addHours(currentGeneric, 1);
            }
        }

        // Sort slots by date and time
        timeSlots.sort((a, b) => new Date(a.iso).getTime() - new Date(b.iso).getTime());

        // Remove duplicates if any (though logic shouldn't produce them unless ranges overlap)
        const uniqueSlots = timeSlots.filter((slot, index, self) =>
            index === self.findIndex((t) => (
                t.date === slot.date && t.time24 === slot.time24
            ))
        );

        return NextResponse.json({ success: true, timeSlots: uniqueSlots });
    } catch (error) {
        console.error('Error in gettimeslots API:', error);
        return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
    }
}
