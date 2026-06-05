import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_KEY = process.env.THE_ODDS_API_KEY || '5c8961cbba10912b732a3ef202f391c6';

export async function GET(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const resolvedParams = await params;
  const eventId = resolvedParams.eventId;

  const { searchParams } = new URL(request.url);
  const sportKey = searchParams.get('sport') || 'soccer'; // fallback to general soccer if not provided
  
  try {
    const primaryUrl = `https://api.the-odds-api.com/v4/sports/soccer/events/${eventId}/odds?apiKey=${API_KEY}&regions=eu,uk&markets=h2h,totals,btts,draw_no_bet,alternate_totals,alternate_spreads,totals_h1,h2h_h1,correct_score`;
    
    let res = await fetch(primaryUrl, { next: { revalidate: 60 } });
    
    if (!res.ok) {
      console.warn(`Failed to fetch event ${eventId}`);
      return NextResponse.json(null);
    }
    
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('The Odds API Error:', err.message);
    return NextResponse.json({ error: 'Failed to load event odds' }, { status: 500 });
  }
}
