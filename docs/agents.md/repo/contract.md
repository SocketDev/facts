# The wire contracts

`src/contract/` holds two formats a second implementation parses:
`.socket.facts.json` (`SocketFactsSbom`) and the resolved-paths sidecar
(`ResolvedPathsSidecar`). They are the reason this package exists as a shared
library rather than a socket-cli internal, so treat them as published shapes.

## Why a shared definition

The reachability consumer hand-maintains its own copies:

- `coana-package-manager/packages/shared-types/src/socket-facts-schema.ts` — a
  parallel type declaration of the SBOM side.
- `.../java/sidecar-artifact-paths.ts` — a zod schema for the sidecar, with
  `.strict()` on the component object.

Two hand-maintained copies of one format drift, and the drift is silent until a
scan produces the wrong answer. What this package exports is a superset the
consumer could import in place of both: the same field names and the same
optionality, plus runtime validators and a coordinate-key helper the consumer
already reimplements.

## `classifier` serializes as an explicit JSON null

The fleet prefers `undefined` over `null` everywhere except here. The sidecar's
consumer types `classifier` as `z.string().nullable()`, and an absent key is a
different payload from an explicit `null`. `validateResolvedPathsSidecar`
therefore rejects a component whose `classifier` key is missing, even though
every other absent-optional would be fine.

## An additive field is a coordinated release

The sidecar consumer's component schema is `.strict()`. Under a strict schema an
unrecognized key is not ignored — it fails the parse, and the failure is
whole-payload, not per-field. So adding **any** field to `ResolvedComponent`,
including a `schemaVersion` intended to make future additions safe, breaks every
consumer pinned to a version released before the addition.

`validateResolvedPathsSidecar` enforces this from the producer side: an unknown
key is a violation here, so a producer cannot emit a payload the consumer will
reject.

### Proposed versioning approach — not adopted

Recorded here so the next person does not have to rederive it. **Do not
implement any of this unilaterally**; it is a change to a format two
organizations parse.

1. **Consumer first, in its own release.** Relax the component schema from
   `.strict()` to `.passthrough()` (or `.strip()`), so an unrecognized key is
   tolerated. Ship it and let it reach the pinned version both sides use. This
   step adds nothing and breaks nothing; it only removes the trap.
2. **Then, and only then, add the envelope.** With tolerant consumers deployed,
   a `schemaVersion` becomes addable, and every later addition is a normal
   additive change instead of a lockstep release.
3. **Record the pin.** `.config/repo/lockstep.json` is where the version pair
   that may talk to each other belongs, so a bump on either side is visible as a
   diff rather than as a scan that silently returns nothing.

The ordering is the whole point: adding `schemaVersion` while the consumer is
still strict is the failure it was meant to prevent.

## The SBOM side is deliberately not strict

`validateSocketFactsSbom` checks types and the `format` discriminant but
tolerates unknown top-level keys, because the SBOM travels to the Socket backend
rather than to a strict parser. Keeping the two validators asymmetric is
intentional: each one mirrors what its real consumer does.
