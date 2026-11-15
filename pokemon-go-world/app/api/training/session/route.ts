import { randomUUID } from "node:crypto";
import { trainingScore } from "../catalog";

interface Session {
  id: string;
  monId: string;
  startedAt: number;
}

const sessions = new Map<string, Session>();

function snapshot(session: Session) {
  const elapsedSec = (Date.now() - session.startedAt) / 1000;
  const score = trainingScore(elapsedSec);
  return {
    sessionId: session.id,
    monId: session.monId,
    ...score,
  };
}

/**
 * Training session (points only; reel cycling is handled on the client).
 * start: open a session for one character.
 * tick: ask for the points earned so far.
 * claim: close the session and return the points to bank.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    action?: string;
    monId?: string;
    sessionId?: string;
  } | null;
  if (!body || (body.action !== "start" && body.action !== "tick" && body.action !== "claim")) {
    return Response.json({ error: "action must be start, tick, or claim" }, { status: 400 });
  }

  if (body.action === "start") {
    if (typeof body.monId !== "string" || body.monId.length === 0 || body.monId.length > 80) {
      return Response.json({ error: "pick a character" }, { status: 400 });
    }
    const session: Session = { id: randomUUID(), monId: body.monId, startedAt: Date.now() };
    sessions.set(session.id, session);
    return Response.json(snapshot(session));
  }

  if (typeof body.sessionId !== "string") {
    return Response.json({ error: "missing session" }, { status: 400 });
  }
  const session = sessions.get(body.sessionId);
  if (!session) return Response.json({ error: "session ended" }, { status: 404 });

  if (body.action === "claim") {
    const snap = snapshot(session);
    sessions.delete(session.id);
    return Response.json({ ...snap, claimed: true });
  }

  return Response.json(snapshot(session));
}
