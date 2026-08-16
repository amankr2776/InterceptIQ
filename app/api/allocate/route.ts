import { NextRequest, NextResponse } from 'next/server';
import { allocate, allocateMinimalSet } from '@/lib/allocator';
import type { Scenario } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/allocate
 * body: { scenario, tNow?, minimiseSites?, salvoDepth?, pkTarget?, subsetTolerance? }
 * Stateless — the client owns scenario state, so this deploys to Vercel as a
 * plain serverless function with no session storage and no WebSocket server.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const sc = body.scenario as Scenario;
    if (!sc?.threats || !sc?.areas) {
      return NextResponse.json({ ok: false, error: 'scenario required' }, { status: 400 });
    }
    const opts = {
      tNow: body.tNow ?? 0,
      salvoDepth: body.salvoDepth ?? 2,
      pkTarget: body.pkTarget ?? 0.9,
      subsetTolerance: body.subsetTolerance ?? 0.05,
    };
    const sol = body.minimiseSites
      ? allocateMinimalSet(sc, opts)
      : allocate(sc, opts);
    return NextResponse.json({ ok: true, solution: sol });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
