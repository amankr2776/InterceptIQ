// Identification of optimal set of multiple interceptor launch areas to maximise the destruction of multiple air targets
import { NextRequest, NextResponse } from 'next/server';
import { generateScenario } from '@/lib/scenario';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const tier = (body.tier ?? 'medium') as 'easy' | 'medium' | 'hard' | 'random';
    const sc = generateScenario({
      tier,
      seed: typeof body.seed === 'number' ? body.seed : undefined,
      nThreats: body.nThreats,
      nAreas: body.nAreas,
    });
    return NextResponse.json({ ok: true, scenario: sc });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const tier = (req.nextUrl.searchParams.get('tier') ?? 'medium') as never;
  const seedRaw = req.nextUrl.searchParams.get('seed');
  const sc = generateScenario({ tier, seed: seedRaw ? Number(seedRaw) : undefined });
  return NextResponse.json({ ok: true, scenario: sc });
}
