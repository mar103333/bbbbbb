import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { searchParams } = new URL(req.url);
    const forceReevaluate = searchParams.get('force') === '1';

    // Fetch pending bets (or all non-parlay bets if forcing re-evaluation)
    let query = supabase.from('bets').select('*').not('market', 'eq', 'parlay');
    if (!forceReevaluate) {
      query = query.eq('status', 'pending');
    }

    const { data: pendingBets, error: fetchError } = await query;

    if (fetchError) throw fetchError;
    if (!pendingBets || pendingBets.length === 0) {
      return NextResponse.json({ message: 'No pending bets found', settled: 0 });
    }

    // Group bets by match ID
    const betsByMatch: Record<string, any[]> = {};
    for (const bet of pendingBets) {
      if (!betsByMatch[bet.match_id]) betsByMatch[bet.match_id] = [];
      betsByMatch[bet.match_id].push(bet);
    }

    let settledCount = 0;

    for (const [matchId, bets] of Object.entries(betsByMatch)) {
      if (matchId.startsWith('apifootball_')) {
        const fixtureId = matchId.split('_')[1];
        
        // Fetch result from API-Football
        const res = await fetch(`https://v3.football.api-sports.io/fixtures?id=${fixtureId}`, {
          headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY || '' },
          next: { revalidate: 0 }
        });
        
        if (!res.ok) continue;
        const data = await res.json();
        const fixture = data?.response?.[0];
        
        if (!fixture) continue;
        
        // Check if match is finished
        const status = fixture.fixture?.status?.short;
        const finishedStatuses = ['FT', 'AET', 'PEN', 'AWD', 'CANC', 'ABD'];
        if (!finishedStatuses.includes(status)) {
          continue; // Match not finished
        }

        const homeScore = fixture.score?.fulltime?.home ?? fixture.goals?.home;
        const awayScore = fixture.score?.fulltime?.away ?? fixture.goals?.away;
        
        // If cancelled or abandoned, maybe void bets, but let's just mark lost for now or skip
        if (homeScore === null || awayScore === null) continue;

        const totalGoals = homeScore + awayScore;
        const homeName = fixture.teams?.home?.name;
        const awayName = fixture.teams?.away?.name;
        
        const bttsResult = (homeScore > 0 && awayScore > 0) ? 'Po' : 'Jo';
        
        let matchWinnerResult = 'Barazim';
        if (homeScore > awayScore) matchWinnerResult = homeName;
        else if (awayScore > homeScore) matchWinnerResult = awayName;

        for (const bet of bets) {
          let hasWon = false;
          let canEvaluate = false;

          const selection = String(bet.selection).replace(/_/g, ' ').replace(/[\[\]]/g, '').trim();

          if (bet.market === 'Match Winner') {
            canEvaluate = true;
            if (selection === homeName || selection === 'Home Victory') hasWon = (homeScore > awayScore);
            else if (selection === awayName || selection === 'Away Victory') hasWon = (awayScore > homeScore);
            else if (selection === 'Draw' || selection === 'Barazim' || selection === 'Match Draw') hasWon = (homeScore === awayScore);
            else hasWon = false;
            
            console.log(`[AutoSettle] Match Winner Eval: sel=${selection}, home=${homeName}(${homeScore}), away=${awayName}(${awayScore}) -> hasWon=${hasWon}`);
          } 
          else if (bet.market === 'Goals Over/Under' || bet.market === 'alternate_totals' || bet.market === 'totals') {
            canEvaluate = true;
            const isOver = selection.toLowerCase().includes('over') || selection.toLowerCase().includes('mbi');
            const isUnder = selection.toLowerCase().includes('under') || selection.toLowerCase().includes('nën');
            
            const match = selection.match(/[\d\.]+/);
            const line = match ? parseFloat(match[0]) : 0;
            
            // Force numeric conversion just in case!
            const tGoals = Number(homeScore) + Number(awayScore);
            
            if (isOver) hasWon = tGoals > line;
            else if (isUnder) hasWon = tGoals < line;
            
            console.log(`[AutoSettle] Goals Eval: sel=${selection}, line=${line}, tGoals=${tGoals}, over=${isOver}, under=${isUnder} -> hasWon=${hasWon}`);
          }
          else if (bet.market === 'Both Teams Score' || bet.market === 'btts') {
            canEvaluate = true;
            const isYes = selection.toLowerCase().includes('yes') || selection.toLowerCase().includes('po');
            const isNo = selection.toLowerCase().includes('no') || selection.toLowerCase().includes('jo');
            
            if (isYes) hasWon = (homeScore > 0 && awayScore > 0);
            else if (isNo) hasWon = (homeScore === 0 || awayScore === 0);
            
            console.log(`[AutoSettle] BTTS Eval: sel=${selection}, home=${homeScore}, away=${awayScore} -> hasWon=${hasWon}`);
          }

          if (canEvaluate) {
            const finalStatus = hasWon ? 'won' : 'lost';
            console.log(`[AutoSettle] Bet ${bet.id} (${bet.market} - ${selection}) -> ${finalStatus}`);
            
            // If forced re-evaluating and it was previously lost but now won, we should credit.
            // If it was previously won and now lost, we should deduct.
            // For simplicity, let's just update the status if we are in force mode, 
            // but we MUST NOT credit the balance twice.
            // So we only credit if it was 'pending' and became 'won'.
            
            await supabase.from('bets').update({ status: finalStatus }).eq('id', bet.id);
            
            // Only update balance if it was newly won
            if (hasWon && bet.status !== 'won') {
              const { data: userData } = await supabase
                .from('profiles')
                .select('balance')
                .eq('id', bet.user_id)
                .single();
                
              if (userData) {
                await supabase
                  .from('profiles')
                  .update({ balance: userData.balance + bet.potential_payout })
                  .eq('id', bet.user_id);
              }
            }
            settledCount++;
          }
        }
      }
    }

    return NextResponse.json({ message: 'Success', settled: settledCount });
  } catch (error: any) {
    console.error('[AutoSettle]', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
