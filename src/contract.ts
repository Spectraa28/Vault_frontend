import { z } from 'zod';
export const characterSchema = z.enum(['door-guard', 'cashier', 'vault-guard']);
export type Character = z.infer<typeof characterSchema>;
export type Role = 'customer' | 'manager';
export const moodSchema = z.enum(['wary', 'curious', 'warming', 'convinced', 'annoyed', 'flustered']);
export type Mood = z.infer<typeof moodSchema>;
export const attemptSchema = z.object({ tool: z.string(), args: z.record(z.string(), z.unknown()), decision: z.enum(['allowed', 'approved', 'blocked', 'rejected', 'timeout', 'held', 'error']), layer: z.enum(['intent', 'policy']).optional(), reason: z.string().optional(), wasHeld: z.boolean().optional(), delegatedTo: z.string().optional(), executed: z.boolean() });
export const eventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('tool'), tool: z.string(), args: z.record(z.string(), z.unknown()), delegatedTo: z.string().optional() }),
  z.object({ type: z.literal('hold'), tool: z.string() }),
  z.object({ type: z.literal('decision'), tool: z.string(), decision: z.enum(['allowed', 'approved', 'blocked', 'rejected', 'timeout', 'held', 'error']), layer: z.enum(['intent', 'policy']).optional(), reason: z.string().optional(), delegatedTo: z.string().optional() }),
  z.object({ type: z.literal('reply'), name: z.string(), reply: z.string(), mood: moodSchema, trust: z.number().int().min(0).max(5), delegate: z.object({ name: z.string(), reply: z.string() }).optional(), unlocked: z.array(characterSchema), cleared: z.array(z.number().int().min(1).max(5)), coldShoulder: z.boolean(), attempts: z.array(attemptSchema), enforcementHeld: z.boolean(), ms: z.number().nonnegative(), audioUrl: z.string().url().optional() }),
  z.object({ type: z.literal('error'), code: z.string(), message: z.string(), retryAfterMs: z.number().optional() }),
]);
export type GameEvent = z.infer<typeof eventSchema>;
export type Reply = Extract<GameEvent, { type: 'reply' }>;
export const startSchema = z.object({ gameId: z.string().min(1), unlocked: z.array(characterSchema) });
export const summarySchema = z.object({ cleared: z.array(z.number().int().min(1).max(5)), turns: z.number().int().min(0), rank: z.string() });
export type Summary = z.infer<typeof summarySchema>;
export const recordingSchema = z.object({ recordedAt: z.string(), note: z.string(), turns: z.array(z.object({ request: z.object({ character: characterSchema, role: z.enum(['customer', 'manager']), text: z.string() }), events: z.array(eventSchema) })) });
export type RecordedTurn = z.infer<typeof recordingSchema>['turns'][number];
export const CAST: Record<Character, { name: string; title: string; greeting: string; position: [number, number, number]; color: string }> = {
  'door-guard': { name: 'Gus', title: 'THE NIGHT WATCH', greeting: "Bank’s closed, friend. Has been since six. State your business.", position: [3.1, 0, 4.1], color: '#35483e' },
  cashier: { name: 'Wren', title: 'THE TELLER', greeting: 'Oh! Hi. Sorry, hi. Welcome to First Meridian. How can I help you tonight?', position: [-2.8, 0, -9], color: '#385b50' },
  'vault-guard': { name: 'Marlowe', title: 'KEEPER OF THE KEYS', greeting: 'Forty years I’ve looked after her. What brings you down here tonight?', position: [2, -3, -29], color: '#655448' },
};
export const LEVELS = [
  ['The inspector', 'Policy holds, however convincing the story.'],
  ['The forged memo', 'Untrusted text cannot change the signed plan.'],
  ['The cab fare', 'A human gets the final say on a held action.'],
  ["The manager’s badge", 'Permission follows the signed-in identity.'],
  ['The inside man', 'Delegation cannot expand the original grant.'],
];
export function decisionLabel(decision: string, layer?: string) {
  if (decision === 'blocked' && layer === 'intent') return 'NOT IN PLAN';
  return ({ allowed: 'ALLOWED', approved: 'APPROVED', blocked: 'BLOCKED', rejected: 'REJECTED', timeout: 'TIMED OUT', held: 'ON HOLD', error: 'ERROR' } as Record<string, string>)[decision] ?? 'PENDING';
}
